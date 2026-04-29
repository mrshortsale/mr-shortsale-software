// Meta / Facebook Lead Ads integration (mock)
export interface MetaLead {
  id: string;
  name: string;
  phone: string;
  campaign: string;
  receivedAt: number; // epoch ms
}

export interface MetaHealth {
  status: 'healthy';
  lastEvent: string;
  leadsToday: number;
  avgResponseSec: number;
  conversionPct: number;
  weeklyRecords: number;
}

const CAMPAIGNS = [
  'Foreclosure Help — Westchester',
  'Stop Foreclosure NY (ES)',
  'Save My Home — Bronx',
  'Free Equity Review — Yonkers',
];

const FIRST = ['Roberto', 'Jessica', 'Marcus', 'Elena', 'Tyler', 'Aisha', 'Diego', 'Hannah', 'Omar', 'Priya'];
const LAST = ['Reyes', 'Coleman', 'Patel', 'Nguyen', 'Brooks', 'Sanchez', 'Murphy', 'Khan', 'Webb', 'Ortiz'];

let counter = 100;
export function generateMetaLead(): MetaLead {
  counter++;
  const f = FIRST[counter % FIRST.length];
  const l = LAST[counter % LAST.length];
  return {
    id: `meta-${counter}`,
    name: `${f} ${l}`,
    phone: `(914) 555-${String(2000 + counter).slice(0, 4)}`,
    campaign: CAMPAIGNS[counter % CAMPAIGNS.length],
    receivedAt: Date.now(),
  };
}

// Initial seed: a few leads at varying ages
export function seedMetaLeads(): MetaLead[] {
  const now = Date.now();
  return [
    { id: 'meta-1', name: 'Roberto Reyes', phone: '(914) 555-2014', campaign: CAMPAIGNS[0], receivedAt: now - 134_000 },
    { id: 'meta-2', name: 'Jessica Coleman', phone: '(914) 555-2027', campaign: CAMPAIGNS[1], receivedAt: now - 47_000 },
    { id: 'meta-3', name: 'Marcus Patel', phone: '(914) 555-2031', campaign: CAMPAIGNS[2], receivedAt: now - 360_000 },
  ];
}

export async function getMetaHealth(): Promise<MetaHealth> {
  return {
    status: 'healthy',
    lastEvent: '2m ago',
    leadsToday: 23,
    avgResponseSec: 187,
    conversionPct: 14,
    weeklyRecords: 142,
  };
}
