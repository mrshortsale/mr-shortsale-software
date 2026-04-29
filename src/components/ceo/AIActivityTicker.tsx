import { useEffect, useState } from 'react';
import { aiActivityFeed, AIActivity } from '@/data/activity';
import { Activity } from 'lucide-react';

const sourceColors: Record<string, string> = {
  Realie: 'text-secondary',
  Batch Leads API: 'text-accent',
  ATTOM: 'text-warning',
  AI: 'text-primary',
  Twilio: 'text-secondary',
  Vapi: 'text-accent',
};

export default function AIActivityTicker() {
  const [items, setItems] = useState<AIActivity[]>(aiActivityFeed.slice(0, 5));

  useEffect(() => {
    const id = setInterval(() => {
      setItems(prev => {
        const next = aiActivityFeed[Math.floor(Math.random() * aiActivityFeed.length)];
        const fresh: AIActivity = { ...next, id: `${Date.now()}`, ts: 'just now' };
        return [fresh, ...prev.slice(0, 4)];
      });
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="metric-card border-l-4 border-l-accent">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <Activity size={16} className="text-accent" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-ping" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent" />
        </div>
        <h3 className="font-bold text-foreground text-sm">AI Activity — Live</h3>
        <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Auto-refresh</span>
      </div>
      <div className="space-y-1.5 font-mono text-xs">
        {items.map((it, i) => (
          <div
            key={it.id + i}
            className="flex items-start gap-2 py-1 px-2 rounded animate-fade-in hover:bg-muted/40"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <span className={`font-bold shrink-0 ${sourceColors[it.source] || 'text-foreground'}`}>{it.source}</span>
            <span className="text-foreground flex-1">{it.message}</span>
            <span className="text-muted-foreground shrink-0">{it.ts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
