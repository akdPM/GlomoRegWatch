import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const relevance = searchParams.get('relevance');
    const status = searchParams.get('status');

    try {
        let query = supabase.from('documents').select('*').order('published_at', { ascending: false });

        if (source && source !== 'All Sources') {
            query = query.eq('source', source);
        }
        if (relevance && relevance !== 'All Relevance') {
            query = query.eq('relevance_score', relevance.replace(' Relevance', ''));
        }
        if (status && status !== 'All Status') {
            const isReviewed = status === 'Reviewed';
            query = query.eq('reviewed', isReviewed);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Fetch the absolute last sync time (either manual or cron)
        const { data: syncData } = await supabase
            .from('sync_logs')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        return NextResponse.json({ success: true, data, last_sync: syncData?.created_at || null });
    } catch (error: any) {
        console.error('Fetch documents error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
