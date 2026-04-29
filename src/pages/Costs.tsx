import { Server, Sparkles, MessageSquare, Database, Mail, ExternalLink, Info } from 'lucide-react';

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
            <span className="inline-block w-8 h-px bg-blue-500" /> Cost Transparency · v1.0
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold leading-tight">
            What you actually pay for
            <span className="block text-blue-400 text-2xl lg:text-3xl mt-2 font-medium">A line-by-line breakdown</span>
          </h1>
          <p className="mt-4 text-slate-400 text-sm lg:text-base max-w-2xl">
            Most agencies hide the math. We show it. Here's exactly what's behind your monthly platform cost
            — what SJ Innovation manages on your behalf, and what each AI request costs at the metal.
          </p>
        </div>
      </header>

      {/* PLATFORM HOSTING */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Infrastructure" title="Platform Hosting & Management" />
          <div className="pf-card p-6 mt-8 border-l-4" style={{ borderLeftColor: '#2563eb' }}>
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <Server size={22} />
              </div>
              <div className="flex-1 min-w-[260px]">
                <p className="text-xl font-bold text-slate-100">Platform Hosting & Management</p>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                  Includes database, uptime monitoring, backups, security patches, and technical support.
                  Managed entirely by SJ Innovation — you just log in and use it.
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-400">$99.00</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider">per month</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t pf-divider">
              <Bullet label="24/7 uptime monitoring" />
              <Bullet label="Daily encrypted backups" />
              <Bullet label="Security patches" />
              <Bullet label="Technical support" />
            </div>
          </div>

          {/* Markup callout */}
          <div className="mt-6 rounded-xl p-5 border border-blue-500/30 bg-blue-500/5 flex gap-4">
            <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-200 leading-relaxed">
              SJ Innovation marks up the raw infrastructure cost to cover platform management, 24/7 monitoring,
              security patches, and technical support. <span className="font-semibold text-slate-100">You are paying
              for a managed service, not just a server.</span> Most clients find this is far cheaper than hiring a
              technical person to manage it themselves.
            </p>
          </div>
        </div>
      </section>

      {/* AI MODELS */}
      <section className="px-6 lg:px-16 py-12 bg-[#0b0d16]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="AI Layer" title="Which models we use, and why" />
          <p className="text-sm text-slate-400 mt-3 max-w-2xl">
            We pick the cheapest model that gets the job done. Heavy reasoning costs more than simple classification —
            so we route each task to the right model.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            <ModelCard
              icon={<Sparkles size={20} />}
              name="GPT-4.1 nano"
              role="Fast lead scoring + script personalization"
              cost="~$0.10 per 1M input tokens"
              note="The workhorse. Runs every lead the moment it lands."
            />
            <ModelCard
              icon={<Sparkles size={20} />}
              name="Gemini 2.5 Flash"
              role="Bulk research + property summarization"
              cost="~$0.075 per 1M input tokens"
              note="Cheapest at scale. Used for batch enrichment overnight."
            />
            <ModelCard
              icon={<Sparkles size={20} />}
              name="Claude Haiku 4.5"
              role="Conversational SMS + nuanced replies"
              cost="~$0.80 per 1M input tokens"
              note="Better tone than GPT for outbound messaging."
            />
          </div>

          <p className="mt-6 text-xs text-slate-500 italic">
            At your projected volume (35,000 leads/mo · ~3 AI passes per lead), total AI spend lands in the $15–$25/mo range.
          </p>
        </div>
      </section>

      {/* OTHER LINE ITEMS */}
      <section className="px-6 lg:px-16 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Everything else" title="The rest of the bill" />
          <div className="pf-card mt-8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b pf-divider">
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">What it does</th>
                  <th className="px-5 py-3 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232a44]">
                <Row what="Batch Leads API" desc="35,000 distressed property leads/month · 3,100 counties" cost="$3.95 / mo flat" />
                <Row what="Twilio SMS" desc="Outbound text messages, ~$0.0079 per SMS" cost="~$5–$15 / mo" />
                <Row what="Mojo Triple Dialer" desc="Already in your stack — billed by Mojo, not us" cost="$0 from us" />
                <Row what="Meta / Facebook Ads API" desc="Speed-to-Lead webhook — Meta charges nothing for this" cost="$0" />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TOTALS */}
      <section className="px-6 lg:px-16 py-12 bg-[#0b0d16]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle eyebrow="Bottom line" title="Two ways to pay" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
            <div className="pf-card p-6 border-l-4" style={{ borderLeftColor: '#2563eb' }}>
              <p className="text-xs uppercase tracking-wider text-blue-400 font-bold">Option A — You control APIs</p>
              <p className="text-3xl font-bold text-slate-100 mt-2">~$118 – $133 / mo</p>
              <p className="text-sm text-slate-400 mt-2">$99 hosting + $3.95 Batch Leads + your own AI/SMS API charges (~$15–30)</p>
            </div>
            <div className="pf-card p-6 border-l-4" style={{ borderLeftColor: '#f97316' }}>
              <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#f97316' }}>Option B — SJ manages all</p>
              <p className="text-3xl font-bold text-slate-100 mt-2">~$125 – $135 / mo flat</p>
              <p className="text-sm text-slate-400 mt-2">One invoice. All APIs included. Zero accounts to manage.</p>
            </div>
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

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-2">{eyebrow}</div>
      <h2 className="text-2xl lg:text-3xl font-bold text-slate-100">{title}</h2>
    </div>
  );
}

function Bullet({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      {label}
    </div>
  );
}

function ModelCard({ icon, name, role, cost, note }: { icon: React.ReactNode; name: string; role: string; cost: string; note: string }) {
  return (
    <div className="pf-card p-5">
      <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center mb-3">{icon}</div>
      <p className="font-bold text-slate-100">{name}</p>
      <p className="text-xs text-slate-400 mt-1">{role}</p>
      <p className="text-sm font-mono text-blue-400 mt-3">{cost}</p>
      <p className="text-xs text-slate-500 italic mt-2">{note}</p>
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
