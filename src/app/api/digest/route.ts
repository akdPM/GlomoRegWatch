import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendDailyDigest } from '@/lib/slack';

export async function GET() {
    try {
        console.log('Daily digest cron triggered...');
        
        // Fetch all documents analyzed in the last 24 hours
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: documents, error } = await supabase
            .from('documents')
            .select('id, source, title, relevance_score, status, published_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!documents || documents.length === 0) {
            console.log('No new documents in last 24h — skipping digest.');
            return NextResponse.json({ success: true, message: 'No new documents today' });
        }

        console.log(`Sending daily digest with ${documents.length} documents...`);
        await sendDailyDigest(documents);

        return NextResponse.json({ success: true, count: documents.length });
    } catch (err: any) {
        console.error('Daily digest error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
