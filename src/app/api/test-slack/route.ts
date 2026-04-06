import { NextResponse } from 'next/server';
import { sendSlackAlert } from '@/lib/slack';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("Triggering explicit Slack push test...");
        
        // Mock a high-priority document to force the webhook to fire
        const mockThreadTs = await sendSlackAlert({
            id: 'test-123',
            title: 'Test Notification from Vercel Production',
            source: 'Vercel Diagnostics',
            source_url: 'https://glomoregwatch.vercel.app',
            relevance_score: JSON.stringify({
                label: 'High',
                total: 10,
                breakdown: { impact: 3, urgency: 3, scope: 2, confidence: 2 }
            }),
            why_it_matters: 'This is a diagnostic test to verify that Vercel has correctly loaded the SLACK_WEBHOOK_URL environment variables and that Slack is not rejecting the payload.',
            action_items: [{ task: 'Verify Slack receipt', owner: 'Admin', due_date: 'Immediate', severity: 'High' }]
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Diagnostic test payload fired successfully!',
            thread_ts_returned: mockThreadTs || 'null (used legacy webhook)'
        });
    } catch (err: any) {
        console.error('Test Slack API error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
