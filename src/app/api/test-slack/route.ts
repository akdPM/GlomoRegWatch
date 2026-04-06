import { NextResponse } from 'next/server';
import { sendSlackAlert } from '@/lib/slack';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("Triggering explicit Slack push test...");
        
        const token = process.env.SLACK_BOT_TOKEN;
        const channel = process.env.SLACK_CHANNEL || '#compliance-alerts';

        if (!token) {
            return NextResponse.json({ success: false, error: "SLACK_BOT_TOKEN is entirely missing from process.env!" });
        }

        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                channel: channel,
                text: "Diagnostic test from Vercel: Verifying Slack Bot Token permissions."
            })
        });

        const data = await res.json();

        return NextResponse.json({ 
            success: data.ok, 
            slack_raw_response: data,
            message: data.ok ? "Bot Token is perfect! Threading should work." : "Bot Token failed! Look at the error above."
        });
    } catch (err: any) {
        console.error('Test Slack API error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
