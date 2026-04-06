import OpenAI from 'openai';
import { GLOMO_CONTEXT } from './config';
import { calculatePriority } from './scoring';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

type ActionItem = {
    task: string;
    owner: string;
    due_date: string;
    severity: string;
};

type AIInsights = {
    summary: string;
    relevance_score: string;
    why_it_matters: string;
    action_items: ActionItem[];
    evidence_excerpt: string;
};

export const parseDocument = async (text: string, source: string): Promise<AIInsights> => {
  const prompt = `
You are the compliance lead for Glomopay.

Business context:
${GLOMO_CONTEXT.company} is an ${GLOMO_CONTEXT.businessModel} in ${GLOMO_CONTEXT.geography} focused on ${GLOMO_CONTEXT.coreFlows.join(', ')}.

Critical risk areas:
${GLOMO_CONTEXT.criticalRiskAreas.map(r => '- ' + r).join('\n')}

Analyze the following regulatory circular from ${source}. For each circular:
1. summarize in plain English
2. explain business impact
3. identify operational changes needed
4. generate action items with owner + due date

Prioritize direct impact on: remittance flows, compliance controls, risk scoring, regulator reporting obligations

Your "why_it_matters" output must be systematic and explicitly answer these 4 questions:
- What workflow changes?
- What risk increases?
- What systems need updates?
- What team owns it?

JSON Specification:
{
  "summary": "...",
  "why_it_matters": "1) Workflow changes: ... 2) Risk increases: ... 3) System updates: ... 4) Team ownership: ...",
  "evidence_excerpt": "Quote the explicit text that provoked relevance.",
  "action_items": [
    {
      "task": "Concrete tasks.",
      "owner": "Accountable team or role.",
      "due_date": "Timeline format.",
      "severity": "High|Medium|Low"
    }
  ]
}

Document text:
${text.substring(0, 10000)}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    // Apply the Hybrid AI Scoring Layer
    const priorityData = calculatePriority(text, parsed.action_items || [], parsed.evidence_excerpt || '');

    return {
        summary: parsed.summary || 'Failed to generate summary.',
        relevance_score: JSON.stringify(priorityData),
        why_it_matters: parsed.why_it_matters || 'No specific impact detected.',
        action_items: parsed.action_items || [],
        evidence_excerpt: parsed.evidence_excerpt || ''
    };
  } catch (err: any) {
    console.error('Error parsing document with OpenAI:', err);
    return {
        summary: 'Analysis failed or API key missing.',
        relevance_score: JSON.stringify(calculatePriority(text, [], '')),
        why_it_matters: 'Action required: Check OpenAI API configuration.',
        action_items: [],
        evidence_excerpt: ''
    };
  }
};
