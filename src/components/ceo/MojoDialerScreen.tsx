import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Send, Activity, CheckCircle, XCircle, Voicemail, Clock, Ban } from 'lucide-react';
import { getMojoStatus, MojoQueueStatus, sendToMojo, MojoOutcome } from '@/integrations/mojoDialer';
import { toast } from 'sonner';

const RECENT: { name: string; outcome: MojoOutcome; agent: string; time: string }[] = [
  { name: 'Patricia Lopez', outcome: 'Interested', agent: 'Maria', time: '8:42 AM' },
  { name: 'James Tran', outcome: 'Voicemail', agent: 'Maria', time: '8:38 AM' },
  { name: 'Sarah Johnson', outcome: 'Callback Scheduled', agent: 'James', time: '8:34 AM' },
  { name: 'Mohammed Ali', outcome: 'No Answer', agent: 'James', time: '8:31 AM' },
  { name: 'Rosa Diaz', outcome: 'Answered', agent: 'Luis', time: '8:27 AM' },
  { name: 'Thomas Walsh', outcome: 'DNC', agent: 'Luis', time: '8:22 AM' },
];

const outcomeStyle: Record<MojoOutcome, { icon: React.ReactNode; cls: string }> = {
  Answered: { icon: <CheckCircle size={12} />, cls: 'bg-accent/15 text-accent' },
  Interested: { icon: <CheckCircle size={12} />, cls: 'bg-accent text-accent-foreground' },
  Voicemail: { icon: <Voicemail size={12} />, cls: 'bg-warning/15 text-warning' },
  'No Answer': { icon: <XCircle size={12} />, cls: 'bg-muted text-muted-foreground' },
  DNC: { icon: <Ban size={12} />, cls: 'bg-destructive/15 text-destructive' },
  'Callback Scheduled': { icon: <Clock size={12} />, cls: 'bg-secondary/15 text-secondary' },
};

export default function MojoDialerScreen() {
  const [status, setStatus] = useState<MojoQueueStatus | null>(null);

  useEffect(() => {
    getMojoStatus().then(setStatus);
  }, []);

  const handleBulkSend = () => {
    sendToMojo(['l1', 'l2', 'l3']).then(r => {
      toast.success(`${r.queued} leads pushed to Mojo Triple Dialer`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-2 text-xs text-foreground">
        <Phone size={14} className="text-primary mt-0.5 shrink-0" />
        <div>
          <strong>How this screen works:</strong> Mr. Short Sale pushes leads into Mojo via the Mojo Triple Dialer API. <strong>Calls are placed by Mojo</strong> on your reps' headsets — not by this app. Outcomes sync back here after each call.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric label="In Queue" value={status?.queued ?? '—'} sub="ready to dial" icon={<Phone size={18} />} accent="primary" />
        <Metric label="Calls Today" value={status?.callsToday ?? '—'} sub="across all agents" icon={<Activity size={18} />} accent="secondary" />
        <Metric label="Connect Rate" value={`${status?.connectRate ?? '—'}%`} sub="3-line dialing live" icon={<CheckCircle size={18} />} accent="accent" />
      </div>

      <div className="metric-card">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-foreground">Mojo Triple Dialer — Bulk Actions</h3>
          <span className="ml-auto text-xs text-muted-foreground">Last sync: {status?.lastSync ?? '—'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleBulkSend} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium flex items-center gap-1.5 hover:opacity-90">
            <Send size={12} /> Send all "New" leads
          </button>
          <button onClick={handleBulkSend} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-xs font-medium flex items-center gap-1.5 hover:opacity-90">
            <Send size={12} /> Send urgency ≥8
          </button>
          <button onClick={handleBulkSend} className="px-3 py-2 border rounded-md text-xs font-medium flex items-center gap-1.5 hover:bg-muted">
            <Send size={12} /> Send Spanish-only batch
          </button>
        </div>
      </div>

      <div className="metric-card">
        <h3 className="font-bold text-foreground mb-3">Recent Mojo Outcomes</h3>
        <div className="space-y-2">
          {RECENT.map((r, i) => {
            const s = outcomeStyle[r.outcome];
            return (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                <Phone size={14} className="text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">{r.agent} · {r.time}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}>
                  {s.icon}{r.outcome}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, icon, accent }: { label: string; value: React.ReactNode; sub: string; icon: React.ReactNode; accent: string }) {
  const border = accent === 'accent' ? 'border-l-accent' : accent === 'secondary' ? 'border-l-secondary' : 'border-l-primary';
  return (
    <div className={`metric-card border-l-4 ${border}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
