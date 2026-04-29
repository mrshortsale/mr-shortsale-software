import { Server, Sparkles, Database, Mail, ExternalLink, Info, Check, X, Bot, ArrowRight, ShieldCheck } from 'lucide-react';

// Standalone client-facing cost transparency page (dark theme, matches /proposal)

export default function Costs() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100 font-sans">
      <style>{`
        .pf-card { background:#1a1f35; border:1px solid #232a44; border-radius:14px; }
        .pf-blue { background:#2563eb; }
        .pf-divider { border-color:#232a44; }
      `}</style>

      {/* HEADER */}
      <header className="px-6 lg:px-16 pt-12 pb-10 border-b pf-divider">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs tracking-widest text-slate-400 uppercase mb-4">
            <span className="inline-block w-8 h-px bg-blue-500" /> Cost Transparency · v1.1 · April 2026
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold leading-tight">
            What you actually pay for
            <span className="block text-blue-400 text-2xl lg:text-3xl mt-2 font-medium">A line-by-line breakdown</span>
          </h1>
          <p className="mt-4 text-slate-400 text-sm lg:text-base max-w-2xl">
            Most agencies hide the math. We show it. Verified pricing as of April 2026 — every model, every agent,
            every dollar accounted for.
          </p>
        </div>
      </header>

      {/* SECTION 1 — TIERED STRATEGY BANNER */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <div
            className="rounded-2xl p-7 lg:p-9 border-2"
            style={{ background: 'linear-gradient(135deg, #052e1c 0%, #064e3b 100%)', borderColor: '#10b981' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <ShieldCheck size={28} className="text-emerald-300" />
              <h2 className="text-xl lg:text-2xl font-bold text-white">
                We use cheap fast models for bulk work, smarter models only when needed.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TierCard
                tier="Tier 1"
                model="GPT-4.1 nano"
                cost="~$2.50/mo"
                use="35K leads scored — bulk classification"
              />
              <TierCard
                tier="Tier 2"
                model="Gemini 2.5 Flash"
                cost="~$5–8/mo"
                use="Enrichment + follow-up reasoning"
              />
              <TierCard
                tier="Tier 3"
                model="Claude Haiku 4.5"
                cost="~$2–4/mo"
                use="Top 5% leads — deep real-estate analysis"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — MODEL COMPARISON */}
      <section className="px-6 lg:px-16 py-12 bg-[#0b0d16]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Model comparison" title="Which models we picked, and which we passed on" />
          <p className="text-sm text-slate-400 mt-3 max-w-2xl">
            Verified pricing April 2026. Same task, very different costs — model choice is the single biggest lever
            on your monthly AI bill.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            <ModelCard
              picked
              tier="Tier 1"
              name="OpenAI GPT-4.1 nano"
              pricing="$0.10 / M input · $0.20 / M output"
              estimate="~$2.50 / mo at 35K leads"
              best="Bulk lead scoring"
            />
            <ModelCard
              picked
              tier="Tier 2"
              name="Google Gemini 2.5 Flash"
              pricing="$0.30 / M in · $2.50 / M out · 1M ctx"
              estimate="~$5–8 / mo"
              best="Enrichment, skip-trace, follow-up logic"
            />
            <ModelCard
              picked
              tier="Tier 3"
              name="Anthropic Claude Haiku 4.5"
              pricing="$1.00 / M input · $5.00 / M output"
              estimate="~$2–4 / mo on top 5% leads"
              best="Nuanced real estate reasoning on hot leads"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
            <ModelCard
              name="GPT-4.1 mini"
              pricing="$0.40 / M in · $1.60 / M out"
              estimate="~$12.60 / mo"
              best="Solid alternative — but 5× the cost of nano"
              verdict="Skipped"
            />
            <ModelCard
              name="GPT-4.1 full"
              pricing="$2.00 / M in · $8.00 / M out"
              estimate="~$63 / mo"
              best="Overkill for bulk classification"
              verdict="Skipped"
            />
            <ModelCard
              name="Gemini 2.5 Pro"
              pricing="$1.25 / M in · $10.00 / M out"
              estimate="~$57 / mo"
              best="Excellent reasoning, but Haiku 4.5 wins on price"
              verdict="Skipped"
            />
          </div>
        </div>
      </section>

      {/* SECTION 3 — AGENT TABLE */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Per-agent breakdown" title="Every AI agent, its model, and what it costs" />
          <div className="pf-card mt-8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b pf-divider">
                  <th className="px-5 py-3 font-medium">Agent</th>
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">Volume</th>
                  <th className="px-5 py-3 font-medium text-right">Cost / mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232a44]">
                <AgentRow agent="Scout" model="GPT-4.1 nano" volume="35K leads ingested + scored" cost="~$2.50" />
                <AgentRow agent="Sherlock" model="Gemini 2.5 Flash" volume="5K leads enriched" cost="~$0.70" />
                <AgentRow agent="Dedup Engine" model="Algorithmic (no AI)" volume="35K records" cost="~$0.50" />
                <AgentRow agent="Speed-to-Lead" model="Rule-based (no AI)" volume="Real-time webhook" cost="$0" />
                <AgentRow agent="Pulse" model="Gemini 2.5 Flash" volume="~1K decisions/day" cost="~$2.50" />
                <AgentRow agent="Deep Analyst" model="Claude Haiku 4.5" volume="Top 5% leads (~1.7K/mo)" cost="~$2.80" />
                <AgentRow agent="Echo" model="GPT-4.1 nano" volume="500 calls/mo summarized" cost="~$0.10" />
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-blue-500/40 bg-blue-500/5">
                  <td colSpan={3} className="px-5 py-4 text-right font-bold text-slate-100">Total AI cost</td>
                  <td className="px-5 py-4 text-right font-bold text-blue-400 text-lg">~$9–15 / mo</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 4 — DATA FLOW */}
      <section className="px-6 lg:px-16 py-12 bg-[#0b0d16]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Privacy" title="What we send to AI — and what we don't" />
          <p className="text-sm text-slate-400 mt-3 max-w-2xl">
            We never send personally identifiable info to AI providers. Only anonymized signals leave our database.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8 items-stretch">
            <FlowCol
              num="1"
              title="What's in the lead record"
              color="#2563eb"
              items={[
                'Owner name',
                'Phone number',
                'Email address',
                'Property address',
                'Estimated equity %',
                'Distress signal type',
                'Lead source',
                'Notes / call history',
              ]}
            />
            <div className="hidden lg:flex items-center justify-center -mx-2">
              <ArrowRight size={28} className="text-slate-600" />
            </div>
            <FlowCol
              num="2"
              title="What gets sent to AI"
              color="#10b981"
              note="Anonymized only"
              items={[
                'Property address (city/ZIP)',
                'Equity % (bucketed)',
                'Distress type',
                'Lead source category',
                '— NOT phone',
                '— NOT email',
                '— NOT SSN',
                '— NOT owner name',
              ]}
              strikeAfter={4}
            />
          </div>

          <div className="mt-5">
            <FlowCol
              num="3"
              title="What AI returns"
              color="#f97316"
              items={[
                'Score (0–100)',
                'Tier (Hot / Warm / Cold)',
                'Reasons (top 3 signals)',
                'Suggested next action',
              ]}
              full
            />
          </div>
        </div>
      </section>

      {/* SECTION 5 — FULL MONTHLY COST TABLE */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Bottom line" title="Your full monthly cost" />
          <div className="pf-card mt-8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b pf-divider">
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">What it does</th>
                  <th className="px-5 py-3 font-medium text-right">Cost / mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232a44]">
                <Row what="Platform Hosting & Management" desc="Hosted, monitored, maintained by SJ Innovation" cost="$99.00" />
                <Row what="Batch Leads API" desc="35,000 leads/month · 3,100 counties · flat fee" cost="$3.95" />
                <Row what="GPT-4.1 nano (OpenAI)" desc="Scout + Echo + Dedup support" cost="~$3–4" />
                <Row what="Gemini 2.5 Flash (Google)" desc="Sherlock enrichment + Pulse decisions" cost="~$3–6" />
                <Row what="Claude Haiku 4.5 (Anthropic)" desc="Deep Analyst on top 5% leads" cost="~$2–4" />
                <Row what="Mojo API" desc="Billed under your existing Mojo subscription" cost="$0 from us" />
                <Row what="Twilio SMS" desc="Outbound text messages, ~$0.0079 per SMS" cost="~$5–15" />
                <Row what="Meta / Facebook Ads API" desc="Speed-to-Lead webhook — Meta charges nothing" cost="$0" />
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-blue-500/40 bg-blue-500/5">
                  <td colSpan={2} className="px-5 py-4 text-right font-bold text-slate-100">Estimated total (Option B — SJ managed)</td>
                  <td className="px-5 py-4 text-right font-bold text-blue-400 text-lg">~$125–135 / mo</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Markup callout */}
          <div className="mt-6 rounded-xl p-5 border border-blue-500/30 bg-blue-500/5 flex gap-4">
            <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-200 leading-relaxed">
              SJ Innovation marks up raw infrastructure to cover platform management, 24/7 monitoring, security
              patches, and technical support. <span className="font-semibold text-slate-100">You're paying for a
              managed service, not a server.</span> Cheaper than hiring a technical person — and dramatically cheaper
              than the $0.80/lead manual cost most teams pay today.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 lg:px-16 py-10 border-t pf-divider">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-slate-100">SJ Innovation</p>
            <a href="mailto:shahed@sjinnovation.com" className="text-sm text-slate-400 hover:text-blue-400 inline-flex items-center gap-1.5 mt-1">
              <Mail size={13} /> shahed@sjinnovation.com
            </a>
          </div>
          <a
            href="/proposal"
            className="inline-flex items-center gap-2 pf-blue text-white px-5 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            View full proposal <ExternalLink size={14} />
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ---------- helpers ---------- */

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-2">{eyebrow}</div>
      <h2 className="text-2xl lg:text-3xl font-bold text-slate-100">{title}</h2>
    </div>
  );
}

function TierCard({ tier, model, cost, use }: { tier: string; model: string; cost: string; use: string }) {
  return (
    <div className="rounded-xl p-4 border border-emerald-400/40 bg-emerald-900/30">
      <p className="text-[11px] uppercase tracking-widest text-emerald-300 font-bold">{tier}</p>
      <p className="font-bold text-white mt-1.5">{model}</p>
      <p className="text-xs text-emerald-100/90 mt-1">{use}</p>
      <p className="text-sm font-mono font-bold text-emerald-300 mt-3">{cost}</p>
    </div>
  );
}

function ModelCard({
  picked,
  tier,
  name,
  pricing,
  estimate,
  best,
  verdict,
}: {
  picked?: boolean;
  tier?: string;
  name: string;
  pricing: string;
  estimate: string;
  best: string;
  verdict?: string;
}) {
  return (
    <div
      className={`pf-card p-5 border-l-4 ${picked ? '' : 'opacity-80'}`}
      style={{ borderLeftColor: picked ? '#10b981' : '#475569' }}
    >
      <div className="flex items-center gap-2 mb-2">
        {picked ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 uppercase tracking-wider">
            <Check size={11} /> {tier}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300 uppercase tracking-wider">
            <X size={11} /> {verdict || 'Skipped'}
          </span>
        )}
      </div>
      <p className="font-bold text-slate-100">{name}</p>
      <p className="text-xs font-mono text-slate-400 mt-2">{pricing}</p>
      <p className="text-sm text-blue-400 font-semibold mt-3">{estimate}</p>
      <p className="text-xs text-slate-500 italic mt-2">{best}</p>
    </div>
  );
}

function AgentRow({ agent, model, volume, cost }: { agent: string; model: string; volume: string; cost: string }) {
  return (
    <tr>
      <td className="px-5 py-3.5 font-semibold text-slate-100 inline-flex items-center gap-2">
        <Bot size={14} className="text-blue-400" /> {agent}
      </td>
      <td className="px-5 py-3.5 text-slate-300 text-xs font-mono">{model}</td>
      <td className="px-5 py-3.5 text-slate-400 text-xs">{volume}</td>
      <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-100">{cost}</td>
    </tr>
  );
}

function FlowCol({
  num,
  title,
  color,
  items,
  note,
  strikeAfter,
  full,
}: {
  num: string;
  title: string;
  color: string;
  items: string[];
  note?: string;
  strikeAfter?: number;
  full?: boolean;
}) {
  return (
    <div className={`pf-card p-5 border-l-4 ${full ? 'lg:col-span-3' : ''}`} style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-sm"
          style={{ background: `${color}25`, color }}
        >
          {num}
        </span>
        <p className="font-bold text-slate-100">{title}</p>
      </div>
      {note && <p className="text-xs italic mb-3" style={{ color }}>{note}</p>}
      <ul className="space-y-1.5 text-sm">
        {items.map((item, i) => {
          const isStrike = strikeAfter !== undefined && i >= strikeAfter;
          return (
            <li key={i} className={`flex items-start gap-2 ${isStrike ? 'text-rose-300/80' : 'text-slate-300'}`}>
              {isStrike ? (
                <X size={14} className="shrink-0 mt-0.5 text-rose-400" />
              ) : (
                <Check size={14} className="shrink-0 mt-0.5" style={{ color }} />
              )}
              <span className={isStrike ? 'line-through' : ''}>{item}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({ what, desc, cost }: { what: string; desc: string; cost: string }) {
  return (
    <tr>
      <td className="px-5 py-3.5 font-semibold text-slate-100">{what}</td>
      <td className="px-5 py-3.5 text-slate-400 text-xs">{desc}</td>
      <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-100">{cost}</td>
    </tr>
  );
}
