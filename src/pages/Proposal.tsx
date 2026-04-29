import { Check, Clock, Database, Zap, Lock, Server, Wrench, FileSpreadsheet, Calendar, FileSignature, Mail, ExternalLink } from 'lucide-react';

// Standalone client-facing proposal — does NOT use the app's design tokens
// because the rest of the app is light-themed. This page is dark on purpose
// for a polished, client-facing document feel.

export default function Proposal() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100 font-sans">
      <style>{`
        .pf-card { background:#1a1f35; border:1px solid #232a44; border-radius:14px; }
        .pf-accent { color:#60a5fa; }
        .pf-blue { background:#2563eb; }
        .pf-orange { color:#f97316; }
        .pf-divider { border-color:#232a44; }
      `}</style>

      {/* HEADER */}
      <header className="px-6 lg:px-16 pt-12 pb-10 border-b pf-divider">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs tracking-widest text-slate-400 uppercase mb-4">
            <span className="inline-block w-8 h-px bg-blue-500" /> Proposal · v1.0
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold leading-tight">
            Mr. Short Sale AI Platform
            <span className="block text-blue-400 text-2xl lg:text-3xl mt-2 font-medium">Phase 1 Proposal</span>
          </h1>
          <p className="mt-4 text-slate-400 text-sm lg:text-base">
            Prepared for <span className="text-slate-200 font-semibold">X-Cap Realty</span> · April 2026
          </p>
        </div>
      </header>

      {/* SUMMARY BAR */}
      <section className="px-6 lg:px-16 py-10 border-b pf-divider">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryStat value="$4,500" label="Phase 1 Build Fee" />
          <SummaryStat value="$99/mo" label="Platform Managed by SJ Innovation" />
          <SummaryStat value="API Flexible" label="Pay direct or let SJ manage" />
          <SummaryStat value="6 Weeks" label="Build Timeline" />
          <SummaryStat value="35,000" label="Leads/mo · 3,100 Counties" />
          <SummaryStat value="You Own It" label="100% Your Platform" highlight />
        </div>
      </section>

      {/* PHASE 1 vs PHASE 2 */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Scope" title="What's in Phase 1 — and what comes later" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
            {/* Phase 1 */}
            <div className="pf-card p-6 border-l-4" style={{ borderLeftColor: '#2563eb' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold pf-blue text-white">PHASE 1</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">Included</span>
              </div>
              <ul className="space-y-3 text-sm">
                <Feature label="AI Lead Dashboard" sub="CEO view + Rep view, full pipeline" />
                <Feature label="Batch Leads API" sub="35K leads/month, 3,100 counties, $3.95/mo flat" />
                <Feature label="AI Lead Scoring" sub="Equity, motivation, property signals" />
                <Feature label="Mojo Triple Dialer API" sub="Auto-push leads, call outcomes sync back" />
                <Feature label="Meta / Facebook Ads Speed-to-Lead" sub="Real-time feed, 5-min alert timer" />
                <Feature label="Bilingual EN / ES" sub="Full interface in English and Spanish" />
                <Feature label="SJ Innovation manages platform" sub="Hosting, updates, support included" />
              </ul>
            </div>
            {/* Phase 2 */}
            <div className="rounded-[14px] p-6 border-2 border-dashed" style={{ borderColor: '#3a4263', background: '#161a2c' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-700 text-slate-200">PHASE 2</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">Coming Later</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                <Pending label="AI Inbound + Outbound Voice Calls" sub="ElevenLabs + Twilio — NOT in Phase 1" />
                <Pending label="ATTOM Property Data cross-verification" sub="Verify equity, AVM, tax delinquency" />
                <Pending label="County Filings Scraper" sub="3,100 counties direct" />
                <Pending label="ICP Learning Loop" sub="AI scoring improves from every closed deal" />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* PICK YOUR API OPTION */}
      <section className="px-6 lg:px-16 py-12 bg-[#0b0d16]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="API Costs" title="Pick your option" />
          <p className="text-sm text-slate-400 mt-3 max-w-2xl">
            APIs (Batch Leads, OpenAI, Twilio) are billed by usage. You choose how you want them handled.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
            {/* Option A */}
            <div className="pf-card p-6 border-l-4" style={{ borderLeftColor: '#2563eb' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold pf-blue text-white">OPTION A</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">You control your APIs</span>
              </div>
              <p className="text-2xl font-bold text-blue-400 mt-2">~$15–$30 / mo<span className="text-sm text-slate-400 font-normal"> in API charges</span></p>
              <ul className="space-y-2.5 mt-5 text-sm">
                <Feature label="Your API accounts" sub="Batch Leads, OpenAI, Twilio in your name" />
                <Feature label="Direct billing" sub="API charges go straight to your credit card" />
                <Feature label="SJ configures + manages" sub="We wire up the connections, you keep control" />
                <Feature label="Full visibility" sub="See exactly what each API costs you each month" />
              </ul>
            </div>
            {/* Option B */}
            <div className="pf-card p-6 border-l-4" style={{ borderLeftColor: '#f97316' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold text-white" style={{ background: '#f97316' }}>OPTION B</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">SJ manages everything</span>
              </div>
              <p className="text-2xl font-bold pf-orange mt-2">~$125–$135 / mo<span className="text-sm text-slate-400 font-normal"> flat — all in</span></p>
              <ul className="space-y-2.5 mt-5 text-sm">
                <Feature label="One flat invoice" sub="Hosting + all APIs on a single monthly bill" />
                <Feature label="Zero vendor accounts" sub="Nothing to set up, monitor, or reconcile" />
                <Feature label="SJ owns the API accounts" sub="We absorb usage spikes within the flat rate" />
                <Feature label="Best for zero overhead" sub="Just log in and use it — nothing else to think about" />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* MONTHLY COST TABLE */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Running Costs" title="Monthly cost summary" />
          <div className="pf-card mt-8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b pf-divider">
                  <th className="px-5 py-3 font-medium">What</th>
                  <th className="px-5 py-3 font-medium">Details</th>
                  <th className="px-5 py-3 font-medium text-right">Cost / Month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232a44]">
                <CostRow what="Platform Hosting & Management" who="Hosted, monitored, maintained by SJ Innovation. You never touch the tech." cost="$99.00" />
                <CostRow what="Batch Leads API" who="35,000 leads/month · 3,100 counties · flat fee" cost="$3.95" />
                <CostRow what="AI + SMS APIs" who="OpenAI, Gemini, Twilio — see Option A or B above" cost="See options" />
                <CostRow what="Mojo Triple Dialer" who="Billed under your existing Mojo subscription" cost="$0 *" />
                <CostRow what="Meta / Facebook Ads API" who="No extra cost — free API" cost="$0" />
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div className="rounded-xl p-5 border border-blue-500/30 bg-blue-500/5">
              <p className="text-xs uppercase tracking-wider text-blue-400 font-bold mb-1">Option A Total</p>
              <p className="text-xl font-bold text-slate-100">~$118 – $133 / mo</p>
              <p className="text-xs text-slate-400 mt-1">$103 base + your API costs (~$15–30)</p>
            </div>
            <div className="rounded-xl p-5 border border-orange-500/30 bg-orange-500/5">
              <p className="text-xs uppercase tracking-wider pf-orange font-bold mb-1">Option B Total</p>
              <p className="text-xl font-bold text-slate-100">~$125 – $135 / mo flat</p>
              <p className="text-xs text-slate-400 mt-1">One invoice · zero overhead · all APIs included</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl p-5 border border-orange-500/30 bg-orange-500/5">
            <p className="text-sm text-slate-200 leading-relaxed">
              <span className="pf-orange font-bold">Compare this to what you pay now:</span> At <strong>$0.80/lead</strong> manually,
              35,000 leads/month = <strong>$28,000/mo</strong> in manual cost.
              At <strong className="pf-orange">~$125/mo</strong>, you get all 35K leads processed and scored automatically.
            </p>
          </div>
        </div>
      </section>

      {/* PAYMENT */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Investment" title="Phase 1 payment schedule" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
            <PayBox amount="$2,250" pct="50% Upfront" detail="To start — due upon signing" />
            <PayBox amount="$2,250" pct="50% On Delivery" detail="Due at launch (Week 6)" />
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400 uppercase tracking-wider">Total Phase 1 Build Fee</p>
            <p className="text-4xl font-bold text-blue-400 mt-1">$4,500</p>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="px-6 lg:px-16 py-12 bg-[#0b0d16]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Delivery" title="6-week build timeline" />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            <TimelineStep n="1–2" title="Foundation" body="Batch Leads API connected, database live, lead dashboard built" />
            <TimelineStep n="3" title="AI Scoring" body="Scoring model trained, deduplication active, CEO + Rep views ready" />
            <TimelineStep n="4" title="Mojo + Meta" body="Mojo Dialer wired, Speed-to-Lead live, call outcomes syncing" />
            <TimelineStep n="5" title="Testing" body="Live testing with real lead data, agent walkthrough, bilingual confirmed" />
            <TimelineStep n="6" title="Launch" body="Platform live, team training, final payment, SJ on support" highlight />
          </div>
        </div>
      </section>

      {/* WHAT YOU OWN */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Ownership" title="What you own at the end" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            <OwnCard icon={<Lock size={22} />} title="100% Your Platform" body="Code, data, leads — all yours. No lock-in." />
            <OwnCard icon={<Database size={22} />} title="Your Data, Your Platform" body="All leads, calls, and history belong to you. Exportable any time." />
            <OwnCard icon={<Wrench size={22} />} title="SJ Manages It All" body="Hosting, updates, bug fixes included." />
          </div>
        </div>
      </section>

      {/* NEXT STEPS */}
      <section className="px-6 lg:px-16 py-12 bg-[#0b0d16]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Next" title="Three steps to launch" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            <StepCard n={1} icon={<FileSpreadsheet size={20} />} title="Send Your Lead Excel Sheet" body="To George, so we build the demo with your real data." />
            <StepCard n={2} icon={<Calendar size={20} />} title="May 4 Demo Call · 11am" body="George runs a live demo using your data." />
            <StepCard n={3} icon={<FileSignature size={20} />} title="Sign & Start" body="Proposal + agreement same day. 50% upfront. Live in 6 weeks." />
          </div>
        </div>
      </section>

      {/* WHAT WE NEED FROM YOU */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Onboarding" title="What we need from you" />
          <p className="text-sm text-slate-400 mt-3 max-w-2xl">
            A short checklist to keep the 6-week build on track. Nothing complicated — most of it lives in tools you already use.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
            {/* LEFT — required before Week 1 */}
            <div className="pf-card p-6 border-l-4" style={{ borderLeftColor: '#f97316' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold text-white" style={{ background: '#f97316' }}>BEFORE WEEK 1</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">Required to start</span>
              </div>
              <ul className="space-y-3 text-sm">
                <NeedItem n="①" label="$2,250 upfront payment" sub="Required to start Week 1" accent="orange" />
                <NeedItem n="②" label="Lead Excel/CSV export" sub="Columns: name, address, phone, lead source, status — for demo build" accent="orange" />
                <NeedItem n="③" label="Mojo Dialer credentials or API key" sub="Needed in Week 4 to wire up the dialer" accent="orange" />
                <NeedItem n="④" label="Facebook Business Manager admin access" sub="Required for the Speed-to-Lead webhook" accent="orange" />
              </ul>
            </div>

            {/* RIGHT — collected in onboarding call */}
            <div className="pf-card p-6 border-l-4" style={{ borderLeftColor: '#10b981' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold text-white" style={{ background: '#10b981' }}>ONBOARDING CALL</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">30 min after signing</span>
              </div>
              <ul className="space-y-3 text-sm">
                <NeedItem n="⑤" label="ICP definition call with George (15 min)" sub="Equity %, property types, target zip codes, distress signals" accent="green" />
                <NeedItem n="⑥" label="Team list" sub="Names, emails, language preference EN or ES per user" accent="green" />
                <NeedItem n="⑦" label="Logo + brand colors (optional)" sub="X-Cap Realty or Mr. Short Sale branding" accent="green" />
                <NeedItem n="⑧" label="API option choice" sub="Option A (your card · ~$15–30/mo) or Option B (SJ manages · ~$125–135/mo flat)" accent="green" />
              </ul>
            </div>
          </div>

          {/* Combined checklist callout */}
          <div className="mt-6 rounded-xl p-5 border border-blue-500/30 bg-blue-500/5">
            <p className="text-xs uppercase tracking-wider text-blue-400 font-bold mb-3">Full Checklist</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {[
                ['①', 'Upfront payment'],
                ['②', 'Lead CSV export'],
                ['③', 'Mojo credentials'],
                ['④', 'Facebook admin'],
                ['⑤', 'ICP call'],
                ['⑥', 'Team list'],
                ['⑦', 'Logo + colors'],
                ['⑧', 'API option'],
              ].map(([n, label]) => (
                <div key={n} className="flex items-center gap-2 text-slate-200">
                  <span className="text-blue-400 font-bold text-base">{n}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4 italic">
              Items ①–④ needed before Week 1. Items ⑤–⑧ collected in a 30-min onboarding call after signing.
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
            href="https://calendly.com/shahedsj/meeting"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 pf-blue text-white px-5 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Book a Call <ExternalLink size={14} />
          </a>
        </div>
        <p className="max-w-6xl mx-auto mt-6 text-[11px] text-slate-500 leading-relaxed">
          * Mojo Triple Dialer is billed under your existing Mojo subscription — no additional cost from this engagement.
          Estimated monthly cost may vary slightly with API usage volume.
        </p>
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

function SummaryStat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`pf-card p-4 ${highlight ? 'border-blue-500/40 bg-blue-500/5' : ''}`}>
      <p className={`text-xl lg:text-2xl font-bold ${highlight ? 'text-blue-400' : 'text-slate-100'}`}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function Feature({ label, sub }: { label: string; sub: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
        <Check size={12} strokeWidth={3} />
      </span>
      <div>
        <p className="font-semibold text-slate-100">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </li>
  );
}

function Pending({ label, sub }: { label: string; sub: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center">
        <Clock size={11} />
      </span>
      <div>
        <p className="font-semibold text-slate-200">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </li>
  );
}

function CostRow({ what, who, cost }: { what: string; who: string; cost: string }) {
  return (
    <tr>
      <td className="px-5 py-3.5 text-slate-200">{what}</td>
      <td className="px-5 py-3.5 text-slate-400 text-xs">{who}</td>
      <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-100">{cost}</td>
    </tr>
  );
}

function PayBox({ amount, pct, detail }: { amount: string; pct: string; detail: string }) {
  return (
    <div className="pf-card p-6 text-center">
      <p className="text-xs uppercase tracking-wider text-blue-400 font-bold">{pct}</p>
      <p className="text-4xl font-bold text-slate-100 mt-2">{amount}</p>
      <p className="text-sm text-slate-400 mt-2">{detail}</p>
    </div>
  );
}

function TimelineStep({ n, title, body, highlight }: { n: string; title: string; body: string; highlight?: boolean }) {
  return (
    <div className={`pf-card p-4 ${highlight ? 'border-blue-500/50 bg-blue-500/5' : ''}`}>
      <div className={`text-xs font-bold uppercase tracking-wider ${highlight ? 'text-blue-400' : 'text-slate-400'}`}>Week {n}</div>
      <p className="font-bold text-slate-100 mt-1">{title}</p>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{body}</p>
    </div>
  );
}

function OwnCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="pf-card p-6">
      <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center mb-3">{icon}</div>
      <p className="font-bold text-slate-100">{title}</p>
      <p className="text-sm text-slate-400 mt-1.5">{body}</p>
    </div>
  );
}

function StepCard({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="pf-card p-6 relative">
      <div className="absolute top-4 right-4 w-7 h-7 rounded-full pf-blue text-white text-xs font-bold flex items-center justify-center">{n}</div>
      <div className="text-blue-400 mb-3">{icon}</div>
      <p className="font-bold text-slate-100">{title}</p>
      <p className="text-sm text-slate-400 mt-1.5">{body}</p>
    </div>
  );
}

function NeedItem({ n, label, sub, accent }: { n: string; label: string; sub: string; accent: 'orange' | 'green' }) {
  const color = accent === 'orange' ? '#f97316' : '#10b981';
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center font-bold text-sm" style={{ background: `${color}20`, color }}>
        {n}
      </span>
      <div>
        <p className="font-semibold text-slate-100">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </li>
  );
}
