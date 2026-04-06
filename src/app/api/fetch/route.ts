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
        const [rbiDocs, ifscaDocs] = await Promise.all([
            scrapeRBI(),
            scrapeIFSCA()
        ]);
        
        const allDocs = [...rbiDocs, ...ifscaDocs];
        const newlyAdded = [];

        for (const doc of allDocs) {
            // Deduplicate by source_url (the most reliable unique key constraint)
            const { data: existing } = await supabase
                .from('documents')
                .select('id, status, summary, relevance_score')
                .eq('source_url', doc.source_url)
                .single();
            
            if (existing) {
                const needsReanalysis = existing.status === 'fetched' || 
                                        existing.summary?.includes('Failed to generate') ||
                                        existing.summary?.includes('Analysis failed') ||
                                        (existing.relevance_score && !existing.relevance_score.startsWith('{'));
                if (!needsReanalysis) {
                    continue;
                }

                console.log(`Re-analyzing stalled document: ${doc.title}`);
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
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (!updateError && analyzed) {
                    newlyAdded.push(analyzed);
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
                continue;
            }

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
                .eq('id', inserted.id)
                .select()
                .single();

            if (!updateError && analyzed) {
                    newlyAdded.push(analyzed);
                    // Fire Slack alert for High priority brand-new circulars
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
                } else {
                    newlyAdded.push(inserted);
                }
        }

        // Record the exact time this sync successfully finished
        await supabase.from('sync_logs').insert({ status: 'success', new_documents_added: newlyAdded.length });

        return NextResponse.json({ success: true, count: newlyAdded.length, new_circulars: newlyAdded });
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
