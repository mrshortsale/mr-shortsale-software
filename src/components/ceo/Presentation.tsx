import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Phone,
  Database,
  Bot,
  Globe,
  Clock,
  DollarSign,
  Target,
  CheckCircle2,
  Rocket,
  Heart,
  Workflow,
  Maximize2,
  X,
} from 'lucide-react';
import workflowDiagram from '@/assets/workflow-v2.svg';

interface Slide {
  id: number;
  render: () => JSX.Element;
}

const slides: Slide[] = [
  // Slide 1 — Cover
  {
    id: 1,
    render: () => (
      <div className="h-full w-full flex flex-col justify-between p-12 lg:p-16 text-primary-foreground relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(210 93% 17%) 0%, hsl(212 70% 27%) 60%, hsl(160 75% 24%) 100%)' }}>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, hsl(0 0% 100%) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, hsl(160 75% 50%) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] opacity-70">Prepared for</p>
            <p className="text-sm font-semibold">Cristina Gaspar · Mr. Short Sale</p>
          </div>
        </div>

        <div className="relative z-10 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.4em] opacity-70 mb-6">SJ Innovation × Mr. Short Sale</p>
          <h1 className="text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
            Your AI Operations Platform.
          </h1>
          <p className="text-xl lg:text-2xl mt-6 opacity-90 font-light leading-relaxed max-w-2xl">
            One platform to replace 5 tools, recover 25+ hours a week, and never miss another after-hours call.
          </p>
        </div>

        <div className="relative z-10 flex items-end justify-between gap-6 flex-wrap">
          <div className="text-sm opacity-70">
            <p className="font-semibold text-primary-foreground">April 2026 · Version 1.0</p>
            <p>Confidential proposal</p>
          </div>
          <div className="flex gap-8">
            {[
              { v: '12', l: 'Weeks' },
              { v: '3', l: 'Phases' },
              { v: '0', l: 'Denials' },
            ].map(s => (
              <div key={s.l} className="text-right">
                <p className="text-3xl font-bold">{s.v}</p>
                <p className="text-xs uppercase tracking-widest opacity-70">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },

  // Slide 2 — The problem today
  {
    id: 2,
    render: () => (
      <div className="h-full w-full grid lg:grid-cols-2 bg-card">
        <div className="p-12 lg:p-16 flex flex-col justify-center bg-muted/40">
          <p className="text-xs uppercase tracking-[0.3em] text-destructive font-semibold mb-4">Where you are today</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
            Your team is fighting the tools, not the deals.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Every morning starts with a 3-day-old Excel file. Agents toggle between Mojo and spreadsheets.
            After-hours leads vanish into voicemail. And you wake up with no picture of how yesterday went.
          </p>
        </div>
        <div className="p-12 lg:p-16 flex flex-col justify-center gap-4">
          {[
            { icon: Clock, t: '3 days late', d: 'Foreclosure data arrives stale — best leads are already taken.' },
            { icon: Target, t: 'No equity filter', d: 'Reps waste calls on unqualified homeowners every single day.' },
            { icon: Phone, t: 'Missed inbound', d: 'After-hours calls go to voicemail. Lost revenue, every night.' },
            { icon: DollarSign, t: '$350/mo for nothing', d: 'You pay for an Excel file you don\'t even own.' },
          ].map(item => (
            <div key={item.t} className="flex gap-4 p-4 rounded-xl border bg-card hover:border-destructive/40 transition-colors">
              <div className="w-11 h-11 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <item.icon size={20} className="text-destructive" />
              </div>
              <div>
                <p className="font-bold text-foreground">{item.t}</p>
                <p className="text-sm text-muted-foreground">{item.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // Slide 3 — What we're building
  {
    id: 3,
    render: () => (
      <div className="h-full w-full p-12 lg:p-16 bg-card flex flex-col">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold mb-4">The solution</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            One AI-powered platform. Built around how <span className="text-accent">you</span> actually work.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12 flex-1">
          {[
            { icon: Database, color: 'secondary', t: 'Same-day data', d: 'Realie.ai + Batch Leads API pull fresh county filings every morning at 6 AM. No more 3-day lag.' },
            { icon: Bot, color: 'accent', t: 'AI-qualified leads', d: 'Every lead is pre-researched, equity-filtered to ≤25%, and arrives with a personalized script ready.' },
            { icon: Phone, color: 'primary', t: '24/7 AI voice agent', d: 'Spanish + English with accent detection. No inbound call ever goes unanswered again.' },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border-2 border-border p-6 flex flex-col hover:shadow-lg transition-shadow"
              style={{ background: 'linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)' }}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-${c.color}/10`}>
                <c.icon size={22} className={`text-${c.color}`} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{c.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 p-5 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-4">
          <Sparkles size={20} className="text-primary shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-bold">You own the entire stack.</span> No vendor dependency. No middleman. The data, the AI, the dashboard — all yours.
          </p>
        </div>
      </div>
    ),
  },

  // Slide 4 — Impact / numbers
  {
    id: 4,
    render: () => (
      <div className="h-full w-full p-12 lg:p-16 flex flex-col justify-center"
        style={{ background: 'linear-gradient(135deg, hsl(160 75% 24%) 0%, hsl(160 75% 18%) 100%)', color: 'white' }}>
        <div className="max-w-2xl mb-12">
          <p className="text-xs uppercase tracking-[0.3em] opacity-70 font-semibold mb-4">What it means for you</p>
          <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
            Real time saved. Real revenue recovered.
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { v: '25+', l: 'hours saved per week', s: 'across your team' },
            { v: '100%', l: 'inbound calls answered', s: 'after-hours included' },
            { v: '3×', l: 'qualified leads per call', s: 'thanks to AI filtering' },
            { v: '$0', l: 'per-lead vendor cost', s: 'you own the source' },
          ].map(s => (
            <div key={s.l} className="border-l-2 border-white/30 pl-5">
              <p className="text-5xl lg:text-6xl font-bold tracking-tight">{s.v}</p>
              <p className="text-sm font-semibold mt-2 uppercase tracking-wider">{s.l}</p>
              <p className="text-xs opacity-70 mt-1">{s.s}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {[
            'Replace 5 disconnected tools with one',
            'Cristina sees everything every morning',
            'Zero leads slip through the cracks',
          ].map(t => (
            <div key={t} className="flex items-center gap-3 text-sm font-medium">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // Slide 5 — Roadmap
  {
    id: 5,
    render: () => (
      <div className="h-full w-full p-12 lg:p-16 bg-card flex flex-col">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-secondary font-semibold mb-4">Delivery plan</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">12 weeks. 3 phases. Live system.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5 flex-1">
          {[
            { p: 'Phase 1', w: 'Weeks 1–4', t: 'Connect & Consolidate', d: 'APIs live, equity filter on, dashboard v1 in your hands.', icon: Database, color: 'secondary' },
            { p: 'Phase 2', w: 'Weeks 5–8', t: 'AI Research Layer', d: 'Every lead pre-researched, scripts auto-generated, urgency scored.', icon: Bot, color: 'accent' },
            { p: 'Phase 3', w: 'Weeks 9–12', t: 'AI Voice — Full Ops', d: 'Inbound AI 24/7. Outbound AI for low-priority. You own it all.', icon: Rocket, color: 'primary' },
          ].map((ph, i) => (
            <div key={ph.p} className="relative rounded-2xl p-7 border-2 flex flex-col"
              style={{ borderColor: i === 0 ? 'hsl(var(--accent))' : 'hsl(var(--border))', background: i === 0 ? 'hsl(var(--accent) / 0.05)' : 'hsl(var(--card))' }}>
              <div className="absolute -top-3 left-7 px-3 py-1 bg-foreground text-background text-xs font-bold rounded-full uppercase tracking-wider">
                {ph.p}
              </div>
              <div className={`w-11 h-11 rounded-lg bg-${ph.color}/10 flex items-center justify-center mb-4 mt-2`}>
                <ph.icon size={20} className={`text-${ph.color}`} />
              </div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{ph.w}</p>
              <h3 className="text-xl font-bold text-foreground mt-1 mb-3">{ph.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{ph.d}</p>
              {i === 0 && (
                <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-accent">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  In progress
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // Slide 6 — End-to-end workflow diagram
  {
    id: 6,
    render: () => <WorkflowSlide />,
  },

  // Slide 7 — Closing
  {
    id: 7,
    render: () => (
      <div className="h-full w-full p-12 lg:p-16 flex flex-col justify-between text-primary-foreground relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(210 93% 17%) 0%, hsl(210 93% 12%) 100%)' }}>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, hsl(160 75% 50%) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.3em] opacity-70 font-semibold">Why this, why now</p>
        </div>

        <div className="relative z-10 max-w-3xl">
          <Heart size={36} className="mb-6 opacity-80" />
          <h2 className="text-4xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
            You've never had a short sale denied.
          </h2>
          <p className="text-2xl lg:text-3xl mt-6 opacity-90 font-light">
            Imagine that record — paired with a system that finally matches the quality of your work.
          </p>
        </div>

        <div className="relative z-10 grid md:grid-cols-2 gap-6 items-end">
          <div>
            <p className="text-sm opacity-70 mb-2">Ready when you are.</p>
            <p className="text-2xl font-bold">Let's start Phase 1 this week.</p>
          </div>
          <div className="md:text-right text-sm opacity-80 leading-relaxed">
            <p className="font-semibold text-primary-foreground">Shahed Islam · CEO, SJ Innovation</p>
            <p>shahed@sjinnovation.com</p>
            <p className="opacity-70 mt-2">Prepared April 2026</p>
          </div>
        </div>
      </div>
    ),
  },
];

const slideTitles = [
  'Cover',
  'The problem',
  'The solution',
  'The impact',
  'Roadmap',
  'Workflow',
  'Why now',
];

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-foreground font-medium">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function WorkflowSlide() {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className="h-full w-full bg-card flex flex-col">
      <div className="px-8 lg:px-10 pt-4 pb-3 border-b shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-secondary font-semibold mb-1 flex items-center gap-2">
              <Workflow size={11} /> How it all connects
            </p>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground leading-tight">
              End-to-end workflow — every system, every signal.
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[9px]">
            <Legend dot="bg-secondary" label="Data Sources" />
            <Legend dot="bg-accent" label="AI Layer" />
            <Legend dot="bg-speed" label="Speed-to-Lead" />
            <Legend dot="bg-primary" label="Operations" />
            <button
              onClick={() => setZoomed(true)}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90"
            >
              <Maximize2 size={10} /> Expand
            </button>
          </div>
        </div>
      </div>
      <div
        className="flex-1 min-h-0 bg-muted/30 p-2 flex items-center justify-center cursor-zoom-in"
        onClick={() => setZoomed(true)}
        title="Click to expand"
      >
        <img
          src={workflowDiagram}
          alt="Mr. Short Sale — updated AI platform workflow v2: data sources, dedup, AI scoring, Mojo dialer, Meta speed-to-lead, AI voice"
          className="w-full h-full object-contain rounded-md bg-card shadow-md"
        />
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-[100] bg-foreground/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card text-foreground flex items-center justify-center hover:bg-muted shadow-lg"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <img
            src={workflowDiagram}
            alt="Mr. Short Sale workflow v2 — full size"
            className="max-w-full max-h-full object-contain bg-card rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default function Presentation() {
  const [current, setCurrent] = useState(0);

  const go = (dir: 1 | -1) => {
    setCurrent(c => Math.min(slides.length - 1, Math.max(0, c + dir)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles size={22} className="text-accent" />
            Your Proposal
          </h2>
          <p className="text-sm text-muted-foreground">A 7-slide summary of what we're building for Mr. Short Sale.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            disabled={current === 0}
            className="w-10 h-10 rounded-lg border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-foreground tabular-nums px-3 min-w-[60px] text-center">
            {current + 1} / {slides.length}
          </span>
          <button
            onClick={() => go(1)}
            disabled={current === slides.length - 1}
            className="w-10 h-10 rounded-lg border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Slide canvas — 16:9 aspect */}
      <div className="rounded-2xl border-2 border-border bg-card shadow-xl overflow-hidden relative" style={{ aspectRatio: '16 / 9' }}>
        <div className="absolute inset-0">
          {slides[current].render()}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrent(i)}
            className={`group rounded-lg border-2 p-3 text-left transition-all ${
              current === i
                ? 'border-accent bg-accent/5 shadow-md'
                : 'border-border bg-card hover:border-muted-foreground/40'
            }`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-wider ${current === i ? 'text-accent' : 'text-muted-foreground'}`}>
              Slide {i + 1}
            </p>
            <p className="text-xs font-semibold text-foreground mt-1 truncate">{slideTitles[i]}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border text-sm text-muted-foreground">
        <TrendingUp size={16} className="text-accent shrink-0" />
        <span>Use the arrows or click any thumbnail to navigate. Share this view with stakeholders for a quick pitch.</span>
      </div>
    </div>
  );
}
