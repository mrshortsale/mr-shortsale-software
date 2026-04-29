// ATTOM Property Data integration (mock)
export interface AttomIntel {
  estimatedValue: number;
  equityPct: number;
  ownerName: string;
  lastSaleDate: string;
  taxDelinquent: boolean;
  highEquity: boolean; // > 20%
}

export async function getAttomHealth() {
  return {
    status: 'healthy' as const,
    lastSync: 'Today 6:08 AM',
    recordsThisWeek: 892,
    description: 'Cross-verification — 158M property records',
  };
}

// Deterministic mock based on lead id for stable demo
export function getAttomIntelForLead(leadId: string, base: { value: number; equity: number; owner: string; purchaseDate: string }): AttomIntel {
  const hash = leadId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const equityAdj = base.equity + ((hash % 7) - 3); // ±3 jitter
  const taxDelinquent = hash % 5 === 0;
  return {
    estimatedValue: base.value + (hash % 9 - 4) * 1000,
    equityPct: Math.max(0, Math.min(95, equityAdj)),
    ownerName: base.owner,
    lastSaleDate: base.purchaseDate,
    taxDelinquent,
    highEquity: equityAdj > 20,
  };
}
