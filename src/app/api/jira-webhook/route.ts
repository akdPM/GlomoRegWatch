import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendSlackThreadReply } from '@/lib/slack';

// Jira calls this webhook when an issue status changes
// Set it up in: Jira → Project Settings → Automations → When Issue Transitions → POST to this URL
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Jira webhook payload structure
        const issueKey = body?.issue?.key;
        const issueStatus = body?.issue?.fields?.status?.name;
        const issueSummary = body?.issue?.fields?.summary || '';

        if (!issueKey || !issueStatus) {
            return NextResponse.json({ success: false, error: 'Invalid Jira webhook payload' }, { status: 400 });
        }

        console.log(`Jira webhook received: ${issueKey} → ${issueStatus}`);

        // Check if this issue is linked to one of our documents
        // We store jira_key inside action_items JSONB
        const { data: docs } = await supabase
            .from('documents')
            .select('id, title, slack_thread_ts, action_items')
            .filter('action_items', 'cs', JSON.stringify([{ jira_key: issueKey }]));

        if (!docs || docs.length === 0) {
            return NextResponse.json({ success: true, message: 'No matching document found' });
        }

        const doc = docs[0];
        const doneStatuses = ['Done', 'Closed', 'Resolved', 'Complete'];

        if (doneStatuses.includes(issueStatus)) {
            // Mark document as reviewed in Supabase
            await supabase
                .from('documents')
                .update({ status: 'reviewed' })
                .eq('id', doc.id);

            console.log(`Document ${doc.id} auto-marked as reviewed via Jira webhook (${issueKey} → ${issueStatus})`);

            // Post thread reply in Slack if we have a thread_ts
            if (doc.slack_thread_ts) {
                await sendSlackThreadReply(
                    doc.slack_thread_ts,
                    `✅ *${issueKey}* resolved in Jira → Document auto-marked as *Reviewed* in GlomoRegWatch.`
                );
            }
        } else {
            // Post status update to Slack thread
            if (doc.slack_thread_ts) {
                await sendSlackThreadReply(
                    doc.slack_thread_ts,
                    `🔄 *${issueKey}* status updated to *${issueStatus}* in Jira. _(${issueSummary.substring(0, 80)})_`
                );
            }
        }

        return NextResponse.json({ success: true, document_id: doc.id, issue: issueKey, status: issueStatus });
    } catch (err: any) {
        console.error('Jira webhook error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
