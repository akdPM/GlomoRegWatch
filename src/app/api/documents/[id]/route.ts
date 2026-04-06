import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendSlackThreadReply } from '@/lib/slack';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { status } = body;

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 });
        }

        // Fetch current doc to get slack_thread_ts and title
        const { data: existing } = await supabase
            .from('documents')
            .select('id, title, slack_thread_ts, status')
            .eq('id', id)
            .single();

        const { data, error } = await supabase
            .from('documents')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Post thread reply when status changes to 'reviewed'
        if (existing?.slack_thread_ts && status === 'reviewed' && existing.status !== 'reviewed') {
            await sendSlackThreadReply(
                existing.slack_thread_ts,
                `✅ *Reviewed* by compliance team in GlomoRegWatch — _${existing.title?.substring(0, 80)}_`
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Update document status error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
