// AI Activity feed — recent automated actions for the live ticker
export interface AIActivity {
  id: string;
  ts: string; // relative time like "2m ago"
  source: 'Realie' | 'BatchLeads' | 'ATTOM' | 'AI' | 'Twilio' | 'Vapi';
  message: string;
}

export const aiActivityFeed: AIActivity[] = [
  { id: 'a1', ts: 'just now', source: 'Realie', message: 'Pulled 3 new NOD filings from Westchester County clerk' },
  { id: 'a2', ts: '2m ago', source: 'ATTOM', message: 'Cross-verified equity on 5 leads — 2 flagged below 25%' },
  { id: 'a3', ts: '4m ago', source: 'AI', message: 'Generated personalized call scripts for 7 new leads' },
  { id: 'a4', ts: '6m ago', source: 'Twilio', message: 'Sent bilingual SMS to Robert Chen — delivered' },
  { id: 'a5', ts: '9m ago', source: 'AI', message: 'Re-scored 12 leads — 3 moved to urgency 8+' },
  { id: 'a6', ts: '12m ago', source: 'BatchLeads', message: 'Fresh NTS feed processed — 4 matches in target ZIPs' },
  { id: 'a7', ts: '15m ago', source: 'Vapi', message: 'AI agent answered inbound call (Spanish) — qualified lead' },
  { id: 'a8', ts: '18m ago', source: 'AI', message: 'Detected duplicate lead from Batch Leads API — auto-merged' },
  { id: 'a9', ts: '22m ago', source: 'ATTOM', message: 'Property valuation refreshed for 8 active pipeline cases' },
  { id: 'a10', ts: '26m ago', source: 'Twilio', message: 'Auto-SMS reply received from Patricia Lopez — flagged hot' },
  { id: 'a11', ts: '31m ago', source: 'Realie', message: 'Sync complete — 47 new filings, 18 equity-qualified' },
  { id: 'a12', ts: '38m ago', source: 'AI', message: 'Generated CEO morning briefing — 5 priority items surfaced' },
];

// Simulated incoming leads for the live "pulse" feel
export const incomingLeadSamples = [
  { address: '33 Birch Ln', city: 'Yonkers', equity: 14, source: 'Realie' as const },
  { address: '87 Oakwood Dr', city: 'White Plains', equity: 11, source: 'BatchLeads' as const },
  { address: '22 Hillcrest Ave', city: 'New Rochelle', equity: 18, source: 'Realie' as const },
  { address: '101 Sunset Pl', city: 'Tarrytown', equity: 9, source: 'ATTOM' as const },
  { address: '55 Glenwood Rd', city: 'Scarsdale', equity: 22, source: 'Realie' as const },
  { address: '14 Meadow Ct', city: 'Mount Vernon', equity: 16, source: 'BatchLeads' as const },
];

// Prior contact history per lead id (sparse — only ~30% of leads)
export interface PriorTouch {
  date: string;
  agent: string;
  channel: 'Call' | 'SMS' | 'Email';
  outcome: string;
}

export const priorContactHistory: Record<string, PriorTouch[]> = {
  l3: [
    { date: 'Mar 18, 2026', agent: 'Maria Santos', channel: 'Call', outcome: 'Voicemail left' },
    { date: 'Mar 22, 2026', agent: 'Maria Santos', channel: 'SMS', outcome: 'Delivered, no reply' },
    { date: 'Apr 9, 2026', agent: 'Maria Santos', channel: 'Call', outcome: 'Connected — interested' },
  ],
  l5: [
    { date: 'Apr 2, 2026', agent: 'Maria Santos', channel: 'Call', outcome: 'No answer' },
    { date: 'Apr 9, 2026', agent: 'Maria Santos', channel: 'SMS', outcome: 'Delivered' },
  ],
  l6: [
    { date: 'Apr 8, 2026', agent: 'Maria Santos', channel: 'Call', outcome: 'Connected — interested' },
  ],
  l7: [
    { date: 'Apr 7, 2026', agent: 'Maria Santos', channel: 'Call', outcome: 'Voicemail' },
    { date: 'Apr 7, 2026', agent: 'Maria Santos', channel: 'SMS', outcome: 'Delivered' },
  ],
  lj1: [
    { date: 'Mar 25, 2026', agent: 'James Rivera', channel: 'Call', outcome: 'Callback declined' },
  ],
  lj6: [
    { date: 'Mar 30, 2026', agent: 'James Rivera', channel: 'Email', outcome: 'Opened, no reply' },
    { date: 'Apr 5, 2026', agent: 'James Rivera', channel: 'Call', outcome: 'Connected — not ready' },
  ],
  ll2: [
    { date: 'Apr 1, 2026', agent: 'Luis Ortega', channel: 'Call', outcome: 'Connected — qualified' },
  ],
  ll11: [
    { date: 'Apr 3, 2026', agent: 'Luis Ortega', channel: 'Call', outcome: 'Callback scheduled' },
  ],
};

export function getPriorContact(leadId: string): PriorTouch[] {
  return priorContactHistory[leadId] || [];
}

export function getUrgencyReason(score: number, daysToAuction: number, equity: number, prior: number): string {
  const parts: string[] = [];
  if (daysToAuction < 35) parts.push(`${daysToAuction} days to auction`);
  else if (daysToAuction < 70) parts.push(`${daysToAuction} days out`);
  if (equity <= 12) parts.push(`${equity}% equity (very low)`);
  else if (equity <= 20) parts.push(`${equity}% equity`);
  if (prior === 0) parts.push('never contacted');
  else parts.push(`${prior} prior touch${prior > 1 ? 'es' : ''}`);
  return `${score}/10: ${parts.join(', ')}`;
}
