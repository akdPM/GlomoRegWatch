import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { OWNER_JIRA_MAP, JIRA_EPIC_KEY } from '@/lib/jira-config';

type ActionItem = {
    task: string;
    owner: string;
    due_date: string;
    severity: string;
};

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SCRUM';

function getPriority(severity: string): string {
    switch (severity?.toLowerCase()) {
        case 'high': return 'High';
        case 'medium': return 'Medium';
        default: return 'Low';
    }
}

async function createJiraTicket(
    actionItem: ActionItem & { assigneeAccountId?: string },
    circularTitle: string,
    circularUrl: string
) {
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

    // Use explicitly passed accountId first, then fall back to the static map
    const assigneeId = actionItem.assigneeAccountId || OWNER_JIRA_MAP[actionItem.owner] || null;

    // Build epic link if configured
    const epicFields: Record<string, any> = {};
    if (JIRA_EPIC_KEY) {
        epicFields['parent'] = { key: JIRA_EPIC_KEY };
    }

    const body = {
        fields: {
            project: { key: JIRA_PROJECT_KEY },
            summary: `[Compliance] ${actionItem.task}`,
            description: {
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'Triggered by regulatory circular: ' },
                            { type: 'text', text: circularTitle, marks: [{ type: 'strong' }] }
                        ]
                    },
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: `Owner: ${actionItem.owner} | Due: ${actionItem.due_date} | Severity: ${actionItem.severity}` }
                        ]
                    },
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: `Source: ${circularUrl}`, marks: [{ type: 'link', attrs: { href: circularUrl } }] }
                        ]
                    }
                ]
            },
            issuetype: { name: 'Task' },
            priority: { name: getPriority(actionItem.severity) },
            labels: ['glomoregwatch', 'compliance', 'regulatory'],
            ...(assigneeId ? { assignee: { id: assigneeId } } : {}),
            ...epicFields
        }
    };

    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jira API error ${response.status}: ${error}`);
    }

    const result = await response.json();
    return {
        id: result.id,
        key: result.key,
        url: `${JIRA_BASE_URL}/browse/${result.key}`,
        task: actionItem.task,
        assignee: actionItem.owner,
        assigneeAccountId: assigneeId
    };
}

export async function POST(request: Request) {
    if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
        return NextResponse.json({
            success: false,
            error: 'Jira is not configured. Add JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY to your .env.local'
        }, { status: 400 });
    }

    try {
        // `assignments` is a map of { [actionItemIndex]: accountId } from the modal
        const { action_items, circular_title, circular_url, document_id, assignments = {}, assigneeNames = {} } = await request.json();

        if (!action_items || action_items.length === 0) {
            return NextResponse.json({ success: false, error: 'No action items provided' }, { status: 400 });
        }

        // Merge the per-task assignee accountId into each action item
        const itemsWithAssignees = action_items.map((item: ActionItem, i: number) => ({
            ...item,
            assigneeAccountId: assignments[i] || null
        }));

        const results = await Promise.allSettled(
            itemsWithAssignees.map((item: any) => createJiraTicket(item, circular_title, circular_url))
        );

        const created = results
            .filter(r => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<any>).value);

        const failed = results
            .filter(r => r.status === 'rejected')
            .map(r => (r as PromiseRejectedResult).reason?.message);

        // If we have a document ID, store ticket keys in DB for status sync
        if (document_id && created.length > 0) {
            const ticketKeys = created.map(t => t.key);
            await supabase.from('documents').update({
                action_items: action_items.map((item: ActionItem, i: number) => ({
                    ...item,
                    jira_key: created[i]?.key || null,
                    jira_url: created[i]?.url || null,
                    assignee_name: assigneeNames[String(i)] || assigneeNames[i] || null
                }))
            }).eq('id', document_id);
            console.log(`Stored Jira keys ${ticketKeys.join(', ')} on document ${document_id}`);
        }

        return NextResponse.json({
            success: true,
            created_count: created.length,
            tickets: created,
            epic: JIRA_EPIC_KEY || null,
            errors: failed.length > 0 ? failed : undefined
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
