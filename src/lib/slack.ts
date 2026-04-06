type ActionItem = {
  task: string;
  owner: string;
  due_date: string;
  severity: string;
};

type PriorityData = {
  label: string;
  total: number;
  breakdown: { impact: number; urgency: number; scope: number; confidence: number; };
};

type AlertDocument = {
  id?: string;
  title: string;
  source: string;
  source_url: string;
  relevance_score: string;
  why_it_matters?: string;
  action_items?: ActionItem[];
};

// Uses Slack Bot API (chat.postMessage) to enable threading + return thread_ts
async function postSlackMessage(payload: object): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  // Prefer Bot Token (supports threading), fall back to Webhook
  if (token) {
    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        console.log(`Slack message posted. thread_ts: ${json.ts}`);
        return json.ts;
      }
      console.warn('Slack Bot API error:', json.error);
    } catch (err: any) {
      console.warn('Slack Bot API exception:', err.message);
    }
  } else if (webhookUrl) {
    // Fallback: Incoming Webhook (no thread ts returned)
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      console.warn('Slack webhook error:', err.message);
    }
  } else {
    console.log('No Slack credentials configured — skipping alert.');
  }
  return null;
}

export async function sendSlackAlert(doc: AlertDocument): Promise<string | null> {
  let priority: PriorityData | null = null;
  try {
    priority = doc.relevance_score?.startsWith('{') ? JSON.parse(doc.relevance_score) : null;
  } catch (_) {}

  const label = priority?.label || doc.relevance_score;
  if (label !== 'High') return null;

  const topAction = doc.action_items?.[0];
  const scoreBreakdown = priority
    ? `Impact: ${priority.breakdown.impact}/3 | Urgency: ${priority.breakdown.urgency}/3 | Scope: ${priority.breakdown.scope}/3 | Confidence: ${priority.breakdown.confidence}/2`
    : '';

  const channel = process.env.SLACK_CHANNEL || '#compliance-alerts';

  const payload: any = {
    channel,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `🚨 High Priority Regulatory Alert — ${doc.source}`, emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${doc.title}*` } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Priority Score:*\n${label}${priority ? ` (${priority.total}/11)` : ''}` },
          { type: 'mrkdwn', text: `*Source:*\n${doc.source}` }
        ]
      },
      ...(scoreBreakdown ? [{ type: 'context', elements: [{ type: 'plain_text', text: scoreBreakdown }] }] : []),
      ...(doc.why_it_matters ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*Why it matters:*\n${doc.why_it_matters.substring(0, 300)}...` }
      }] : []),
      ...(topAction ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*Top Action Item:*\n>${topAction.task}\nOwner: ${topAction.owner} | Due: ${topAction.due_date} | Severity: ${topAction.severity}` }
      }] : []),
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '🔗 View Circular', emoji: true }, url: doc.source_url, style: 'primary' }] }
    ]
  };

  return postSlackMessage(payload);
}

export async function sendSlackThreadReply(threadTs: string, message: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return; // Thread replies require Bot Token

  const channel = process.env.SLACK_CHANNEL || '#compliance-alerts';

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, thread_ts: threadTs, text: message })
  });
}

export async function sendDailyDigest(documents: any[]): Promise<void> {
  if (documents.length === 0) return;

  const channel = process.env.SLACK_CHANNEL || '#compliance-alerts';
  const bySource = documents.reduce((acc: Record<string, any[]>, doc: any) => {
    if (!acc[doc.source]) acc[doc.source] = [];
    acc[doc.source].push(doc);
    return acc;
  }, {});

  const summaryLines = Object.entries(bySource).map(([source, docs]) => {
    return `*${source}* (${docs.length})\n` + docs.map((d: any) => {
      let label = d.relevance_score;
      if (label?.startsWith('{')) { try { label = JSON.parse(label).label; } catch(_) {} }
      return `  • ${d.title.substring(0, 80)} — _${label}_`;
    }).join('\n');
  }).join('\n\n');

  const high = documents.filter((d: any) => {
    let l = d.relevance_score;
    if (l?.startsWith('{')) { try { l = JSON.parse(l).label; } catch(_) {} }
    return l === 'High';
  }).length;

  const payload = {
    channel,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `📋 GlomoRegWatch Daily Regulatory Digest — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, emoji: true } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Total Circulars:*\n${documents.length}` },
        { type: 'mrkdwn', text: `*🔴 High Priority:*\n${high}` }
      ]},
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: summaryLines } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'Auto-generated by GlomoRegWatch • Glomopay Compliance Intelligence' }] }
    ]
  };

  await postSlackMessage(payload);
}
