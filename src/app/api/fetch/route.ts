import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { parseDocument } from '@/lib/openai';
import { scrapeRBI } from '@/lib/scrapers/rbi';
import { scrapeIFSCA } from '@/lib/scrapers/ifsca';
import { sendSlackAlert } from '@/lib/slack';

export const maxDuration = 60; // Max allowed duration on Vercel Hobby tier is 60s
export const dynamic = 'force-dynamic'; // Prevent Next.js POST/GET caching

export async function POST() {
    try {
        console.log("Starting ingestion from RBI and IFSCA sources...");
        let rbiDocs: any[] = [];
        let ifscaDocs: any[] = [];

        try {
            rbiDocs = await scrapeRBI();
            console.log(`Successfully scraped ${rbiDocs.length} RBI circulars`);
        } catch (e: any) {
            console.error('RBI Scraper failed (Likely WAF IP Block):', e.message);
        }

        try {
            ifscaDocs = await scrapeIFSCA();
            console.log(`Successfully scraped ${ifscaDocs.length} IFSCA circulars`);
        } catch (e: any) {
            console.error('IFSCA Scraper failed (Likely WAF IP Block):', e.message);
        }
        
        const allDocs = [...rbiDocs, ...ifscaDocs];
        const newlyAdded: any[] = [];

        // 1. Bulk DB check to save network Round Trips
        const allUrls = allDocs.map(d => d.source_url);
        const { data: existingDocs } = await supabase
            .from('documents')
            .select('id, source_url, status, summary, relevance_score')
            .in('source_url', allUrls);
        const existingMap = new Map((existingDocs || []).map(d => [d.source_url, d]));

        // 2. Identify the backlog of documents requiring processing
        const backlog = allDocs.filter(doc => {
            const existing = existingMap.get(doc.source_url);
            if (!existing) return true; // Brand new document
            
            // Needs re-analysis if stuck in fetched or corrupted
            return existing.status === 'fetched' || 
                   existing.summary?.includes('Failed to generate') ||
                   existing.summary?.includes('Analysis failed') ||
                   (existing.relevance_score && !existing.relevance_score.startsWith('{'));
        });

        // 3. HARD LIMIT for Vercel Hobby 60s execution limit (AI takes ~8sec each)
        // Processing more than 5 sequentially guarantees a 504 Timeout on new databases.
        const processingBatch = backlog.slice(0, 5);
        const hasMore = backlog.length > 5;
        console.log(`Discovered ${backlog.length} unprocessed circulars. Processing batch of 5 to respect Vercel limits...`);

        // 4. Process the batch
        for (const doc of processingBatch) {
            const existing = existingMap.get(doc.source_url);
            let targetId = existing?.id;

            if (!existing) {
                console.log(`Saving new document: ${doc.title}`);
                const { data: inserted, error: insertError } = await supabase
                    .from('documents')
                    .insert({
                        source: doc.source,
                        title: doc.title,
                        source_url: doc.source_url,
                        pdf_url: doc.pdf_url,
                        published_at: doc.published_at,
                        raw_text: doc.raw_text,
                        status: 'fetched'
                    })
                    .select()
                    .single();

                if (insertError || !inserted) {
                    console.error('Error inserting document:', insertError);
                    continue;
                }
                targetId = inserted.id;
            } else {
                console.log(`Re-analyzing stalled document: ${doc.title}`);
            }

            console.log(`Triggering AI Analysis for: ${doc.title}`);
            const aiInsights = await parseDocument(doc.raw_text, doc.source);

            const { data: analyzed, error: updateError } = await supabase
                .from('documents')
                .update({
                    summary: aiInsights.summary,
                    relevance_score: aiInsights.relevance_score,
                    why_it_matters: aiInsights.why_it_matters,
                    action_items: aiInsights.action_items,
                    evidence_excerpt: aiInsights.evidence_excerpt,
                    status: 'analyzed'
                })
                .eq('id', targetId)
                .select()
                .single();

            if (!updateError && analyzed) {
                newlyAdded.push(analyzed);
                
                // Fire Slack alert for High priority brand-new circulars
                // At this exact moment, SLACK_CHANNEL MUST be correct!
                const threadTs = await sendSlackAlert({
                    id: analyzed.id,
                    title: analyzed.title,
                    source: analyzed.source,
                    source_url: analyzed.source_url,
                    relevance_score: analyzed.relevance_score,
                    why_it_matters: analyzed.why_it_matters,
                    action_items: analyzed.action_items
                });
                
                if (threadTs) {
                    await supabase.from('documents').update({ slack_thread_ts: threadTs }).eq('id', analyzed.id);
                }
            }
        }

        // Only record a global successful sync if the ENTIRE backlog is completely cleared
        if (!hasMore) {
             await supabase.from('sync_logs').insert({ status: 'success', new_documents_added: newlyAdded.length });
        }

        return NextResponse.json({ 
            success: true, 
            count: newlyAdded.length, 
            new_circulars: newlyAdded,
            has_more: hasMore,
            message: hasMore ? `Processed 5 circulars. ${backlog.length - 5} remaining in backlog. Click Fetch again as Vercel limits us to 60 seconds!` : `All caught up!`
        });
    } catch (error: any) {
        console.error('Ingestion API error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// Vercel Cron calls GET — forward to the same pipeline
export async function GET() {
    console.log('Cron job triggered — running automated ingestion pipeline...');
    return POST();
}
