import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { agents, Agent, totalActionsToday, hoursSavedThisWeek } from '@/data/agents';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Activity } from 'lucide-react';
import AgentActivityDrawer from './AgentActivityDrawer';

const statusDot: Record<string, string> = {
  active: 'bg-accent',
  working: 'bg-secondary animate-pulse',
  idle: 'bg-muted-foreground/40',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  working: 'Working',
  idle: 'Idle',
};

export default function AIAgentsRoster() {
  const [selected, setSelected] = useState<Agent | null>(null);
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';

  const onSee = (a: Agent) => {
    setSelected(a);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Hero strip */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-4 right-4 flex items-center gap-2 text-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="opacity-90 uppercase tracking-wider font-semibold">All systems operational</span>
        </div>
        <h2 className="text-3xl lg:text-4xl font-bold mb-2">Your AI Workforce</h2>
        <p className="text-sm opacity-90 mb-5 max-w-xl">
          Six specialized AI agents working 24/7 inside your business — finding leads, verifying data, scoring urgency, writing scripts, and following up. So your team focuses on closing.
        </p>
        <div className="flex flex-wrap gap-6 text-sm">
          <HeroStat value={`${agents.length}`} label={t('ai.agents.title')} />
          <HeroStat value={totalActionsToday.toLocaleString(loc)} label={t('ai.agents.actionsToday')} />
          <HeroStat value={`${hoursSavedThisWeek} hrs`} label="saved this week" />
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} onSee={() => onSee(agent)} />
        ))}
      </div>

      <AgentActivityDrawer agent={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function AgentCard({ agent, onSee }: { agent: Agent; onSee: () => void }) {
  const Icon = agent.icon;
  return (
    <div className="rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Colored header strip */}
      <div className={`bg-gradient-to-br ${agent.gradient} p-5 text-primary-foreground`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-card/20 backdrop-blur flex items-center justify-center text-2xl shrink-0">
              {agent.emoji}
            </div>
            <div>
              <h3 className="text-xl font-bold leading-tight">{agent.name}</h3>
              <p className="text-xs opacity-90 flex items-center gap-1.5 mt-0.5">
                <Icon size={11} /> {agent.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold bg-card/20 backdrop-blur rounded-full px-2 py-1">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot[agent.status]}`} />
            {statusLabel[agent.status]}
          </div>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
        <p className="text-sm text-foreground leading-relaxed">{agent.shortDescription}</p>

        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Powered by</p>
          <div className="flex flex-wrap gap-1.5">
            {agent.stack.map(s => (
              <Badge key={s} variant="secondary" className="text-[10px] px-2 py-0">{s}</Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {agent.stats.map(s => (
            <div key={s.label} className="text-center bg-muted/40 rounded-md py-2">
              <p className="text-base font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 mt-auto">
          <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
            <Activity size={11} className="text-accent mt-0.5 shrink-0" />
            <span className="flex-1 truncate" title={agent.lastAction}>{agent.lastAction}</span>
            <span className="shrink-0">{agent.lastActionTime}</span>
          </div>
          <button
            onClick={onSee}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-primary hover:bg-muted/60 rounded-md transition-colors"
          >
            See activity <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
