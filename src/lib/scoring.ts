export function scoreImpact(text: string): number {
    if (!text) return 0;
    const upperText = text.toUpperCase();
    const weights: Record<string, number> = {
      "LRS": 3, "FATF": 3, "AML": 3, "KYC": 3, "SANCTIONS": 3, "REMITTANCE": 3,
      "PURPOSE CODE": 2, "TCS": 2, "REPORTING": 2, "CONSULTATION": 1
    };
    let maxScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (upperText.includes(key)) {
        maxScore = Math.max(maxScore, weight);
      }
    }
    return maxScore;
}
  
export function scoreUrgency(text: string): number {
    if (!text) return 0;
    const lowerText = text.toLowerCase();
    if (lowerText.match(/effective immediately|from today|shall comply forthwith|immediate compliance|immediately|now/)) return 3;
    if (lowerText.match(/within \d+ days|by [a-z]+ \d+|days from|take effect on/)) return 2;
    if (lowerText.match(/future policy|consultation paper|proposed|draft/)) return 1;
    return 0; 
}

export function scoreScope(actionItems: any[]): number {
    if (!actionItems || actionItems.length === 0) return 0;
    const owners = new Set(actionItems.map(item => item.owner));
    if (owners.size >= 2) return 3; // cross-functional
    if (owners.size === 1) return 2; // single function
    return 1; // minor
}
  
export function scoreConfidence(evidenceExcerpt: string): number {
    if (!evidenceExcerpt || evidenceExcerpt.includes('Failed')) return 0;
    if (evidenceExcerpt.length > 20) return 2; // explicit evidence
    if (evidenceExcerpt.length > 0) return 1; // some inferred
    return 0;
}
  
export function calculatePriority(rawText: string, actionItems: any[], evidenceExcerpt: string) {
    const impact = scoreImpact(rawText);
    const urgency = scoreUrgency(rawText);
    const scope = scoreScope(actionItems);
    const confidence = scoreConfidence(evidenceExcerpt);
  
    const total = impact + urgency + scope + confidence;
    let label = "Not Relevant";
    if (total >= 9) label = "High";
    else if (total >= 6) label = "Medium";
    else if (total >= 3) label = "Low";
  
    return { label, total, breakdown: { impact, urgency, scope, confidence } };
}
