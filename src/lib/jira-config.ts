// Owner-to-Jira Account ID mapping
// Fill in your team's Jira account IDs from:
// Jira → Project Settings → People → Copy user ID from URL
export const OWNER_JIRA_MAP: Record<string, string> = {
    "Compliance Ops": process.env.JIRA_ACCOUNT_COMPLIANCE_OPS || '',
    "Compliance Team": process.env.JIRA_ACCOUNT_COMPLIANCE_OPS || '',
    "IT Department": process.env.JIRA_ACCOUNT_IT || '',
    "Risk Team": process.env.JIRA_ACCOUNT_RISK || '',
    "HR/Compliance Training": process.env.JIRA_ACCOUNT_HR || '',
    "Training Department": process.env.JIRA_ACCOUNT_HR || '',
};

export const JIRA_EPIC_KEY = process.env.JIRA_EPIC_KEY || '';
