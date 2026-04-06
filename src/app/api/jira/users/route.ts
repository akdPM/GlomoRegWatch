import { NextResponse } from 'next/server';

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

export async function GET() {
    if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
        return NextResponse.json({ success: false, error: 'Jira is not configured.' }, { status: 400 });
    }

    try {
        const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
        const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/user/assignable/search?project=${JIRA_PROJECT_KEY}`, {
            headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
            cache: 'no-store'
        });

        if (!res.ok) {
            console.error('Jira API returned', res.status);
            return NextResponse.json({ success: false, error: 'Failed to fetch Jira users.' }, { status: res.status });
        }

        const users = await res.json();
        
        // Filter out bots and addons to provide clean UI
        const activeUsers = users
            .filter((u: any) => u.accountType === 'atlassian' && u.active)
            .map((u: any) => ({
                accountId: u.accountId,
                displayName: u.displayName,
                avatarUrls: u.avatarUrls
            }));

        return NextResponse.json({ success: true, users: activeUsers });
    } catch (err: any) {
        console.error('Fetch Jira users error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
