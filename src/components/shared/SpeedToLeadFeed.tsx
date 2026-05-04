import { useEffect, useState } from 'react';
import { generateMetaLead, MetaLead, seedMetaLeads } from '@/integrations/metaAds';
import { Zap, ArrowUpToLine, Volume2, VolumeX, Clock, Facebook, Info } from 'lucide-react';
import { toast } from 'sonner';

function fmtAge(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
}

interface Props { compact?: boolean; }

export default function SpeedToLeadFeed({ compact = false }: Props) {
  const [leads, setLeads] = useState<MetaLead[]>(() => seedMetaLeads());
  const [now, setNow] = useState(Date.now());
  const [soundOn, setSoundOn] = useState(false);

  // Tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Simulate a new Meta lead arriving every ~25-45s
  useEffect(() => {
    const schedule = () => {
      const delay = 25000 + Math.random() * 20000;
      return setTimeout(() => {
        const lead = generateMetaLead();
        setLeads(prev => [lead, ...prev].slice(0, 6));
        toast(`⚡ Speed-to-Lead: ${lead.name}`, {
          description: `${lead.campaign} · Call within 5 min`,
        });
        if (soundOn) {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 880; g.gain.value = 0.05;
            o.start(); o.stop(ctx.currentTime + 0.15);
          } catch {}
        }
        timer = schedule();
      }, delay);
    };
    let timer = schedule();
    return () => clearTimeout(timer);
  }, [soundOn]);

  const handleCallNow = (lead: MetaLead) => {
    toast.success(`${lead.name} pushed to top of Mojo queue`, {
      description: 'Mojo Triple Dialer will dial this lead on your next pickup',
    });
    setLeads(prev => prev.filter(l => l.id !== lead.id));
  };

  return (
    <div className="rounded-xl border-2 border-speed/40 bg-gradient-to-br from-speed/5 to-card overflow-hidden">
      <div className="bg-speed text-speed-foreground px-4 py-2.5 flex items-center gap-2">
        <Zap size={16} className="animate-pulse" fill="currentColor" />
        <span className="font-bold text-sm uppercase tracking-wider">Speed-to-Lead · Meta Ads</span>
        <span className="ml-auto flex items-center gap-3">
          <button onClick={() => setSoundOn(s => !s)} className="opacity-90 hover:opacity-100" title={soundOn ? 'Mute alerts' : 'Enable sound'}>
            {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <span className="text-xs font-medium opacity-90 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            Live
          </span>
        </span>
      </div>
      <div className={`p-3 space-y-2 ${compact ? 'max-h-72 overflow-y-auto' : ''}`}>
        {leads.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">Waiting for next Meta lead…</div>
        )}
        {leads.map(lead => {
          const ageMs = now - lead.receivedAt;
          const overdue = ageMs > 5 * 60_000;
          return (
            <div key={lead.id} className={`rounded-lg border p-3 flex items-center gap-3 ${overdue ? 'border-destructive/50 bg-destructive/5' : 'border-speed/30 bg-card'}`}>
              <div className="shrink-0 w-9 h-9 rounded-full bg-speed/15 text-speed flex items-center justify-center">
                <Facebook size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{lead.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{lead.phone}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{lead.campaign}</p>
              </div>
              <div className="text-right shrink-0">
                <div className={`flex items-center gap-1 text-xs font-mono font-bold ${overdue ? 'text-destructive animate-pulse' : 'text-speed'}`}>
                  <Clock size={11} />
                  {fmtAge(ageMs)}
                </div>
                <p className="text-[9px] text-muted-foreground uppercase">{overdue ? 'Overdue' : 'Fresh'}</p>
              </div>
              <button
                onClick={() => handleCallNow(lead)}
                className="shrink-0 px-3 py-2 bg-speed text-speed-foreground rounded-lg text-xs font-bold flex items-center gap-1 hover:opacity-90"
              >
                <Phone size={12} /> Call Now
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
