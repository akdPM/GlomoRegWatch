import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendSlackThreadReply } from '@/lib/slack';
import { OWNER_JIRA_MAP } from '@/lib/jira-config';

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

// Explicit Jira poll for when webhooks are not configured
export async function POST() {
    if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
        return NextResponse.json({ success: false, error: 'Jira is not configured.' }, { status: 400 });
    }

    try {
        console.log("Starting manual Jira sync...");
        const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

        // Get all analyzed documents that might have open Jira tickets
        const { data: docs } = await supabase
            .from('documents')
            .select('id, title, status, action_items, slack_thread_ts')
            .eq('status', 'analyzed')
            .not('action_items', 'is', null);

        if (!docs || docs.length === 0) {
            return NextResponse.json({ success: true, message: 'No documents pending Jira sync.', updated_count: 0 });
        }

        let updatedCount = 0;

        for (const doc of docs) {
            const actionItems = doc.action_items;
            if (!Array.isArray(actionItems)) continue;

            const jiraKeys = actionItems.map((item: any) => item.jira_key).filter(Boolean);
            if (jiraKeys.length === 0) continue;

            let allDone = true;
            let itemsModified = false;

            for (const item of actionItems) {
                if (!item.jira_key) {
                    allDone = false;
                    continue;
                }

                const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${item.jira_key}?fields=status`, {
                    headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
                    cache: 'no-store'
                });

                if (res.ok) {
                    const json = await res.json();
                    const statusName = json.fields?.status?.name?.toLowerCase();
                    const isDone = ['done', 'closed', 'resolved', 'complete'].includes(statusName);
                    
                    if (!isDone) allDone = false;

                    // Update the individual ticket status in our JSON
                    if (item.status !== statusName) {
                        item.status = statusName;
                        itemsModified = true;
                    }
                } else {
                    console.warn(`Failed to fetch status for Jira issue ${item.jira_key}`);
                    allDone = false; // Err on side of caution
                }
            }

            if (itemsModified || allDone) {
                const updatePayload: any = { action_items: actionItems };
                
                if (allDone) {
                    console.log(`Document ${doc.id} - all tickets are DONE. Marking as reviewed.`);
                    updatePayload.status = 'reviewed';
                }

                await supabase
                    .from('documents')
                    .update(updatePayload)
                    .eq('id', doc.id);

                updatedCount++;

                if (allDone && doc.slack_thread_ts) {
                    await sendSlackThreadReply(
                        doc.slack_thread_ts,
                        `✅ All associated Jira tickets have been completed.\nDocument auto-marked as *Reviewed* in GlomoRegWatch.`
                    );
                }
            }
        }

        return NextResponse.json({ success: true, updated_count: updatedCount, message: `Synced successfully. ${updatedCount} circulars marked as reviewed.` });

    } catch (err: any) {
        console.error('Jira sync error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
