// AI Agent roster — the "AI Workforce"
import { Target, Search, Zap, MessageCircle, Phone, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AgentStatus = 'active' | 'working' | 'idle';

export interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  icon: LucideIcon;
  accent: 'secondary' | 'primary' | 'destructive' | 'warning' | 'accent' | 'muted';
  gradient: string; // tailwind gradient classes
  status: AgentStatus;
  shortDescription: string;
  longDescription: string[];
  stack: string[];
  stats: { label: string; value: string }[];
  lastAction: string;
  lastActionTime: string;
  weeklyImpact: { hoursSaved: string; actions: string; accuracy: string };
  flow: string;
  activitySources: string[]; // matches AIActivity.source values
}

export const agents: Agent[] = [
  {
    id: 'scout',
    name: 'Scout',
    role: 'Lead Hunter',
    emoji: '🎯',
    icon: Target,
    accent: 'secondary',
    gradient: 'from-secondary/90 to-secondary/60',
    status: 'active',
    shortDescription: 'Pulls fresh foreclosure filings from Realie.ai + BatchData every morning at 6 AM.',
    longDescription: [
      'Connects to Realie.ai and BatchData APIs every morning at 6:00 AM sharp.',
      'Filters filings by your target ZIP codes (Westchester, Bronx, Queens).',
      'De-duplicates and pushes only fresh records into your queue.',
      'You wake up to a curated list — no manual scraping, no missed filings.',
    ],
    stack: ['Realie.ai', 'BatchData'],
    stats: [
      { label: 'Pulled today', value: '47' },
      { label: 'Target ZIPs', value: '12' },
      { label: 'Dupes filtered', value: '8' },
    ],
    lastAction: 'Pulled 3 new NOD filings from Westchester County clerk',
    lastActionTime: 'just now',
    weeklyImpact: { hoursSaved: '6.4 hrs', actions: '312', accuracy: '100%' },
    flow: 'Realie.ai + BatchData → Scout → Lead Queue',
    activitySources: ['Realie', 'BatchData'],
  },
  {
    id: 'sherlock',
    name: 'Sherlock',
    role: 'Research Analyst',
    emoji: '🔍',
    icon: Search,
    accent: 'primary',
    gradient: 'from-primary/90 to-primary/60',
    status: 'working',
    shortDescription: 'Cross-verifies every lead against ATTOM, calculates equity, flags discrepancies.',
    longDescription: [
      'Pulls property data from ATTOM for every new lead within seconds.',
      'Calculates true equity using mortgage balance vs. current valuation.',
      'Flags discrepancies between sources so you trust the data.',
      'Surfaces beds, baths, sqft, year built, last sale, and lender info.',
    ],
    stack: ['ATTOM', 'GPT-4o'],
    stats: [
      { label: 'Verified today', value: '47' },
      { label: 'Discrepancies', value: '2' },
      { label: 'Avg time', value: '4s' },
    ],
    lastAction: 'Cross-verified equity on 5 leads — 2 flagged below 25%',
    lastActionTime: '2m ago',
    weeklyImpact: { hoursSaved: '4.8 hrs', actions: '286', accuracy: '99.2%' },
    flow: 'Scout → Sherlock (ATTOM) → Verified Lead Card',
    activitySources: ['ATTOM'],
  },
  {
    id: 'pulse',
    name: 'Pulse',
    role: 'Urgency Scorer',
    emoji: '⚡',
    icon: Zap,
    accent: 'destructive',
    gradient: 'from-destructive/90 to-warning/60',
    status: 'active',
    shortDescription: 'Scores every lead 1–10 based on auction date, equity, and prior contact.',
    longDescription: [
      'Looks at days-to-auction, equity %, prior touch history, and filing chain.',
      'Assigns a 1–10 urgency score so reps always know who to call first.',
      'Re-scores leads automatically when new signals arrive.',
      'Surfaces the "why" behind every score — fully explainable.',
    ],
    stack: ['GPT-4o'],
    stats: [
      { label: 'Scored today', value: '47' },
      { label: 'Urgency 8+', value: '11' },
      { label: 'Re-scored', value: '12' },
    ],
    lastAction: 'Re-scored 12 leads — 3 moved to urgency 8+',
    lastActionTime: '9m ago',
    weeklyImpact: { hoursSaved: '3.1 hrs', actions: '198', accuracy: '100%' },
    flow: 'Sherlock → Pulse → Urgency Badge on Lead',
    activitySources: ['AI'],
  },
  {
    id: 'echo',
    name: 'Echo',
    role: 'Script Writer',
    emoji: '💬',
    icon: MessageCircle,
    accent: 'accent',
    gradient: 'from-accent/90 to-accent/60',
    status: 'active',
    shortDescription: 'Generates personalized bilingual call scripts for every lead in seconds.',
    longDescription: [
      'Writes a custom opening, key talking points, and objection handlers per lead.',
      'Switches between English and Spanish based on detected language preference.',
      'Pulls in the homeowner\'s name, property details, and urgency signals.',
      'Reps open the lead → script is already there. No prep time.',
    ],
    stack: ['GPT-4o'],
    stats: [
      { label: 'Scripts today', value: '47' },
      { label: 'Bilingual', value: '22' },
      { label: 'Avg time', value: '2s' },
    ],
    lastAction: 'Generated personalized call scripts for 7 new leads',
    lastActionTime: '4m ago',
    weeklyImpact: { hoursSaved: '5.6 hrs', actions: '329', accuracy: '100%' },
    flow: 'Pulse → Echo → Personalized Script in Lead Card',
    activitySources: ['AI'],
  },
  {
    id: 'voice',
    name: 'Voice',
    role: '24/7 Receptionist',
    emoji: '📞',
    icon: Phone,
    accent: 'secondary',
    gradient: 'from-secondary/90 to-primary/60',
    status: 'active',
    shortDescription: 'Answers every inbound call in English or Spanish, transcribes, extracts data.',
    longDescription: [
      'Picks up after hours, weekends, and overflow — never miss a call again.',
      'Detects Spanish vs. English on the first sentence and switches accordingly.',
      'Asks qualifying questions and extracts name, address, mortgage status.',
      'Creates a lead in your queue if qualified, or schedules a callback.',
    ],
    stack: ['Vapi', 'GPT-4o'],
    stats: [
      { label: 'Calls / 24h', value: '6' },
      { label: 'Qualified', value: '3' },
      { label: 'Spanish', value: '2' },
    ],
    lastAction: 'AI agent answered inbound call (Spanish) — qualified lead',
    lastActionTime: '15m ago',
    weeklyImpact: { hoursSaved: '2.4 hrs', actions: '42', accuracy: '97%' },
    flow: 'Inbound Call → Voice (Vapi) → Lead Queue + Transcript',
    activitySources: ['Vapi'],
  },
  {
    id: 'dispatch',
    name: 'Dispatch',
    role: 'Follow-Up Bot',
    emoji: '📱',
    icon: Send,
    accent: 'accent',
    gradient: 'from-accent/90 to-secondary/60',
    status: 'working',
    shortDescription: 'Sends bilingual SMS the moment a call goes unanswered.',
    longDescription: [
      'Detects unanswered outbound calls within seconds.',
      'Sends a personalized bilingual SMS with the rep\'s name and a callback link.',
      'Tracks delivery, reads, and replies — flags hot replies to the rep.',
      'No more "we forgot to follow up" — every miss gets a touch.',
    ],
    stack: ['Twilio'],
    stats: [
      { label: 'Sent today', value: '14' },
      { label: 'Replied', value: '4' },
      { label: 'Delivery', value: '100%' },
    ],
    lastAction: 'Auto-SMS reply received from Patricia Lopez — flagged hot',
    lastActionTime: '26m ago',
    weeklyImpact: { hoursSaved: '1.1 hrs', actions: '80', accuracy: '100%' },
    flow: 'Missed Call → Dispatch (Twilio) → SMS Thread',
    activitySources: ['Twilio'],
  },
];

export const totalActionsToday = 1247;
export const hoursSavedThisWeek = 23.4;

export function getAgentById(id: string): Agent | undefined {
  return agents.find(a => a.id === id);
}
