import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchSheetLeads,
  subscribeSheetLeads,
  leadDisplaySubtitle,
  pushSheetLeadsToMojo,
  type SheetLead,
} from '@/services/sheetsLeads';
import { Zap, Volume2, VolumeX, Clock, FileSpreadsheet, Info, ArrowUpToLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function fmtAge(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
}

interface Props {
  compact?: boolean;
  tab?: string | null;
  maxLeads?: number;
}

export default function SpeedToLeadFeed({ compact = false, tab = null, maxLeads = 5 }: Props) {
  const [leads, setLeads] = useState<SheetLead[]>([]);
  const [now, setNow] = useState(Date.now());
  const [soundOn, setSoundOn] = useState(false);
  const soundOnRef = useRef(soundOn);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchSheetLeads(tab, maxLeads).then(({ leads: initial, error }) => {
      if (cancelled) return;
      if (error) {
        toast.error(error);
        setLeads([]);
      } else {
        setLeads(initial ?? []);
      }
      setLoading(false);
    });

    const unsubscribe = subscribeSheetLeads(tab, (lead) => {
      setLeads((prev) => {
        if (prev.some((l) => l.id === lead.id)) return prev;
        return [lead, ...prev].slice(0, maxLeads);
      });
      toast(t('speedFeed.toastTitle', { name: lead.owner }), {
        description: t('speedFeed.toastDesc', { campaign: leadDisplaySubtitle(lead) }),
      });
      if (soundOnRef.current) {
        try {
          const WebkitAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          const Ctx = window.AudioContext || WebkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = 880;
          g.gain.value = 0.05;
          o.start();
          o.stop(ctx.currentTime + 0.15);
        } catch {
          // ignore audio errors
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tab, maxLeads, t]);

  const handlePushToMojo = async (lead: SheetLead) => {
    setPushing((prev) => new Set(prev).add(lead.id));
    const result = await pushSheetLeadsToMojo([lead]);
    setPushing((prev) => {
      const next = new Set(prev);
      next.delete(lead.id);
      return next;
    });
    if (result.ok) {
      toast.success(t('speedFeed.pushedToMojo', { name: lead.owner }), {
        description: t('speedFeed.pushedToMojoDesc'),
      });
    } else {
      toast.error(result.errors[0] ?? t('speedFeed.pushFailed'));
    }
  };

  const title = tab ? t('speedFeed.titleTab', { tab }) : t('speedFeed.titleAll');

  return (
    <div className="rounded-xl border-2 border-speed/40 bg-gradient-to-br from-speed/5 to-card overflow-hidden">
      <div className="bg-speed text-speed-foreground px-4 py-2.5 flex items-center gap-2">
        <Zap size={16} className="animate-pulse" fill="currentColor" />
        <span className="font-bold text-sm uppercase tracking-wider">{title}</span>
        <span className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setSoundOn((s) => !s)}
            className="opacity-90 hover:opacity-100"
            title={soundOn ? t('speedFeed.muteAlerts') : t('speedFeed.enableSound')}
          >
            {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <span className="text-xs font-medium opacity-90 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            {t('speedFeed.live')}
          </span>
        </span>
      </div>
      <div className="px-4 py-1.5 bg-speed/5 border-b border-speed/20 text-[10.5px] text-muted-foreground flex items-center gap-1.5">
        <Info size={10} className="text-speed shrink-0" />
        <span>{t('speedFeed.latestLeadsNote', { count: maxLeads })}</span>
      </div>
      <div className={`p-3 space-y-2 ${compact ? 'max-h-72 overflow-y-auto' : ''}`}>
        {loading && (
          <div className="text-center py-6 text-xs text-muted-foreground">{t('speedFeed.loading')}</div>
        )}
        {!loading && leads.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">{t('speedFeed.waiting')}</div>
        )}
        {leads.map((lead) => {
          const ageMs = now - lead.receivedAt;
          const isPushing = pushing.has(lead.id);
          return (
            <div
              key={lead.id}
              className="rounded-lg border border-speed/30 bg-card p-3 flex items-center gap-3"
            >
              <div className="shrink-0 w-9 h-9 rounded-full bg-speed/15 text-speed flex items-center justify-center">
                <FileSpreadsheet size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground truncate">{lead.owner}</span>
                  {lead.phone && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {lead.phone}
                    </span>
                  )}
                  {lead.tab && !tab && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-speed/10 text-speed font-medium">
                      {lead.tab}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{leadDisplaySubtitle(lead)}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-speed">
                  <Clock size={11} />
                  {fmtAge(ageMs)}
                </div>
              </div>
              <button
                onClick={() => void handlePushToMojo(lead)}
                disabled={isPushing || !lead.phone}
                className="shrink-0 px-3 py-2 bg-speed text-speed-foreground rounded-lg text-xs font-bold flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
                title={t('speedFeed.pushToTopTitle')}
              >
                {isPushing ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpToLine size={12} />}
                {t('speedFeed.pushToTop')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
