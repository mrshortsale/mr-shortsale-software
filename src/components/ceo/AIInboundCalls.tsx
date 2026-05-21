import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiInboundCalls, AIInboundCall } from '@/data/calls';
import { Bot, ChevronDown, ChevronUp, Play, FileText } from 'lucide-react';

export default function AIInboundCalls() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-secondary/10 to-accent/10 border border-secondary/20 p-4 flex items-start gap-3">
        <Bot size={20} className="text-secondary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-foreground">{t('ai.inboundCalls.heroTitle')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('ai.inboundCalls.heroSubtitle')}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-secondary">{aiInboundCalls.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('ai.inboundCalls.callsPerDay')}</p>
        </div>
      </div>

      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 text-muted-foreground font-medium">{t('ai.inboundCalls.caller')}</th>
              <th className="pb-3 text-muted-foreground font-medium">{t('ai.inboundCalls.dateTime')}</th>
              <th className="pb-3 text-muted-foreground font-medium">{t('ai.inboundCalls.language')}</th>
              <th className="pb-3 text-muted-foreground font-medium">{t('ai.inboundCalls.duration')}</th>
              <th className="pb-3 text-muted-foreground font-medium">{t('ai.inboundCalls.outcome')}</th>
              <th className="pb-3 text-muted-foreground font-medium">{t('ai.inboundCalls.property')}</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {aiInboundCalls.map(call => (
              <CallRow key={call.id} call={call} expanded={expandedId === call.id} onToggle={() => setExpandedId(expandedId === call.id ? null : call.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CallRow({ call, expanded, onToggle }: { call: AIInboundCall; expanded: boolean; onToggle: () => void }) {
  const turns = call.transcript.split('\n').filter(Boolean);

  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <td className="py-3 font-medium text-foreground">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-secondary" />
            {call.caller}
          </div>
        </td>
        <td className="py-3 text-muted-foreground">{call.date_time}</td>
        <td className="py-3"><span className={call.language === 'ES' ? 'badge-es' : 'badge-en'}>{call.language}</span></td>
        <td className="py-3 text-foreground">{call.duration}</td>
        <td className="py-3">
          <span className={call.outcome.includes('Qualified') ? 'badge-qualified' : call.outcome.includes('Not') || call.outcome.includes('Hung') ? 'badge-urgent' : 'badge-pending'}>
            {call.outcome}
          </span>
        </td>
        <td className="py-3 text-muted-foreground">{call.property}</td>
        <td className="py-3">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="p-4 bg-muted/30">
            {/* Audio waveform mock */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-card rounded-lg border">
              <button className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:opacity-90">
                <Play size={14} />
              </button>
              <div className="flex-1 flex items-center gap-0.5 h-8">
                {Array.from({ length: 60 }).map((_, i) => {
                  const h = 20 + Math.abs(Math.sin(i * 0.7)) * 80;
                  return <div key={i} className="w-1 bg-secondary/40 rounded-full" style={{ height: `${h}%` }} />;
                })}
              </div>
              <span className="text-xs text-muted-foreground font-mono">{call.duration}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Transcript */}
              <div className="bg-card rounded-lg border p-3 max-h-72 overflow-y-auto">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileText size={12} /> Turn-by-turn Transcript
                </h4>
                <div className="space-y-2">
                  {turns.map((turn, i) => {
                    const isAI = turn.startsWith('AI:');
                    const isCaller = turn.startsWith('Caller:');
                    const text = turn.replace(/^(AI:|Caller:)\s*/, '');
                    return (
                      <div key={i} className={`flex ${isAI ? 'justify-start' : isCaller ? 'justify-end' : 'justify-center'}`}>
                        <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${isAI ? 'bg-secondary/10 text-foreground' : isCaller ? 'bg-muted text-foreground' : 'text-muted-foreground italic'}`}>
                          {(isAI || isCaller) && <span className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${isAI ? 'text-secondary' : 'text-muted-foreground'}`}>{isAI ? 'AI' : 'Caller'}</span>}
                          {text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extracted data */}
              <div className="space-y-3">
                <div className="bg-card rounded-lg border p-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">AI Summary</h4>
                  <p className="text-sm text-foreground">{call.ai_summary}</p>
                </div>
                <div className="bg-card rounded-lg border p-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Structured Data Extracted</h4>
                  <div className="space-y-1.5 text-xs">
                    <KV k="Caller name" v={call.caller} />
                    <KV k="Property" v={call.property} />
                    <KV k="Language" v={call.language === 'ES' ? 'Spanish' : 'English'} />
                    <KV k="Outcome" v={call.outcome} />
                    <KV k="Lead created" v={call.lead_created ? '✓ Yes — added to queue' : 'No'} highlight={call.lead_created} />
                  </div>
                </div>
                {call.lead_created && (
                  <button className="w-full py-2 bg-accent text-accent-foreground rounded-lg text-xs font-semibold hover:opacity-90">
                    View created lead in queue →
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function KV({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-medium text-right ${highlight ? 'text-accent' : 'text-foreground'}`}>{v}</span>
    </div>
  );
}
