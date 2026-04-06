export const GLOMO_CONTEXT = {
  company: "Glomopay",
  businessModel: "IFSC licensed remittance platform",
  geography: "GIFT City, India",
  coreFlows: [
    "outward remittances",
    "LRS transactions",
    "cross-border payments"
  ],
  criticalRiskAreas: [
    "AML",
    "KYC",
    "FATF screening",
    "sanctions",
    "LRS limits",
    "TCS"
  ],
  regulators: [
    "IFSCA",
    "RBI",
    "FEMA",
    "FATF"
  ]
};

export function boostRelevance(text: string): boolean {
  const keywords = [
    "LRS",
    "KYC",
    "AML",
    "FATF",
    "sanctions",
    "remittance",
    "purpose code",
    "TCS"
  ];
  return keywords.some(k => text.toUpperCase().includes(k.toUpperCase()));
}
