import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { realtorPipelineStages, RealtorLeadStatus } from '@/data/realtorLeads';
import { fetchRealtorReps, type RealtorAgent } from '@/services/realtor';
import {
  fetchZillowLeads,
  patchZillowLead,
  zillowLeadToRealtorAgent,
} from '@/services/zillowApify';
import { Building2, Calendar, GripVertical, Home, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import RealtorLeadDetailDrawer from '@/components/shared/RealtorLeadDetailDrawer';
import SourceProvenance from '@/components/shared/SourceProvenance';

const stageColor: Record<RealtorLeadStatus, string> = {
  'New':         'border-l-secondary',
  'Contacted':   'border-l-speed',
  'Partnered':   'border-l-accent',
  'Closed Won':  'border-l-accent',
  'Declined':    'border-l-muted-foreground',
};

const stageBadge: Record<RealtorLeadStatus, string> = {
  'New':         'bg-secondary/10 text-secondary',
  'Contacted':   'bg-speed/15 text-speed',
  'Partnered':   'bg-accent/15 text-accent',
  'Closed Won':  'bg-accent text-accent-foreground',
  'Declined':    'bg-muted text-muted-foreground',
};

function stageLabel(stage: RealtorLeadStatus, t: (key: string) => string): string {
  if (stage === 'Closed Won') return t('realtorQueue.status.closedWon');
  return t(`realtorQueue.status.${stage.toLowerCase()}`);
}

export default function RealtorPipeline() {
  const [agents, setAgents] = useState<RealtorAgent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [repNames, setRepNames] = useState<string[]>([]);
  const [drawerAgent, setDrawerAgent] = useState<RealtorAgent | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { t } = useTranslation();

  const repOptions = useMemo(() => ['Unassigned', ...repNames], [repNames]);
  const draggingAgent = useMemo(
    () => agents.find(a => a.id === draggingId) ?? null,
    [agents, draggingId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    fetchRealtorReps().then(({ reps }) => {
      setRepNames(reps.map(r => r.name).filter(Boolean));
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const all: RealtorAgent[] = [];
    let total = 0;
    let offset = 0;
    const pageSize = 200;

    for (;;) {
      const { leads, total: pageTotal, error } = await fetchZillowLeads({ limit: pageSize, offset });
      if (error) {
        setLoadError(error);
        setAgents([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      total = pageTotal;
      all.push(...leads.map(zillowLeadToRealtorAgent));
      if (all.length >= total || leads.length < pageSize) break;
      offset += pageSize;
    }

    setLoading(false);
    setLoadError(null);
    setAgents(all);
    setTotalCount(total);
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchAgent = (id: string, patch: Partial<RealtorAgent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
    setDrawerAgent(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  };

  const handleStatusChange = async (agent: RealtorAgent, status: RealtorLeadStatus) => {
    const previousStatus = agent.status;
    patchAgent(agent.id, { status });

    const { error } = await patchZillowLead({ id: agent.id, status });
    if (error) {
      patchAgent(agent.id, { status: previousStatus });
      toast.error(error);
      return;
    }
    toast.success(`Moved to ${status}`);
  };

  const handleAssignRep = async (agent: RealtorAgent, rep: string) => {
    const repValue = rep === 'Unassigned' ? null : rep;
    patchAgent(agent.id, { assignedRep: repValue });
    const { error } = await patchZillowLead({ id: agent.id, assignedRep: repValue });
    if (error) {
      toast.error(`Failed to assign rep: ${error}`);
      patchAgent(agent.id, { assignedRep: agent.assignedRep });
    }
  };

  const resolveDropStatus = (overId: string | number, overData: Record<string, unknown> | undefined): RealtorLeadStatus | null => {
    if (overData?.type === 'column' && typeof overData.status === 'string') {
      return overData.status as RealtorLeadStatus;
    }
    if (overData?.type === 'card' && typeof overData.status === 'string') {
      return overData.status as RealtorLeadStatus;
    }
    if (realtorPipelineStages.includes(overId as RealtorLeadStatus)) {
      return overId as RealtorLeadStatus;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const agent = agents.find(a => a.id === active.id);
    if (!agent) return;

    const newStatus = resolveDropStatus(over.id, over.data.current as Record<string, unknown> | undefined);
    if (!newStatus || newStatus === agent.status) return;

    handleStatusChange(agent, newStatus);
  };

  const handleDragCancel = () => setDraggingId(null);

  return (
    <div className="space-y-4">
      <SourceProvenance chips={[{ source: 'Zillow Apify', count: t('realtorQueue.listingsCount', { count: totalCount }), lastSync: 'live', status: loadError ? 'pending' : totalCount > 0 ? 'connected' : 'pending' }]} />

      {loadError && (
        <div className="metric-card border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center justify-between gap-3">
          <span>Failed to load pipeline: {loadError}</span>
          <button
            type="button"
            onClick={() => load()}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card border text-foreground text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading pipeline…
        </div>
      )}

      <div className="rounded-xl bg-gradient-to-r from-secondary/10 to-accent/10 border border-secondary/20 p-4">
        <div className="flex items-start gap-3">
          <Building2 className="text-secondary mt-0.5" size={20} />
          <div>
            <h3 className="font-bold text-foreground">{t('realtorPipeline.chainTitle')}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('realtorPipeline.chainDescription')}
            </p>
            {!loading && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Drag cards between columns to update status. Click a card to open details.
              </p>
            )}
          </div>
        </div>
      </div>

      {!loading && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {realtorPipelineStages.map(stage => (
              <PipelineColumn
                key={stage}
                stage={stage}
                label={stageLabel(stage, t)}
                badgeClass={stageBadge[stage]}
                agents={agents.filter(a => a.status === stage)}
                draggingId={draggingId}
                onOpen={setDrawerAgent}
                t={t}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
            {draggingAgent ? (
              <PipelineCardContent
                agent={draggingAgent}
                stage={draggingAgent.status}
                borderClass={stageColor[draggingAgent.status]}
                isDragging
                t={t}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <RealtorLeadDetailDrawer
        key={drawerAgent?.id ?? 'none'}
        agent={drawerAgent ?? ({} as RealtorAgent)}
        open={!!drawerAgent}
        onOpenChange={(open) => { if (!open) setDrawerAgent(null); }}
        reps={repOptions}
        onStatusChange={handleStatusChange}
        onAssignRep={handleAssignRep}
      />
    </div>
  );
}

function PipelineColumn({
  stage,
  label,
  badgeClass,
  agents,
  draggingId,
  onOpen,
  t,
}: {
  stage: RealtorLeadStatus;
  label: string;
  badgeClass: string;
  agents: RealtorAgent[];
  draggingId: string | null;
  onOpen: (agent: RealtorAgent) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { type: 'column', status: stage },
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/40 rounded-xl p-3 min-h-[400px] transition-colors ${
        isOver ? 'ring-2 ring-secondary bg-secondary/5' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold px-2 py-1 rounded ${badgeClass}`}>{label}</span>
        <span className="text-xs font-bold text-muted-foreground">{agents.length}</span>
      </div>
      <div className="space-y-2 min-h-[320px]">
        {agents.map(agent => (
          <PipelineCard
            key={agent.id}
            agent={agent}
            stage={stage}
            isGhost={draggingId === agent.id}
            onOpen={onOpen}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function PipelineCard({
  agent,
  stage,
  isGhost,
  onOpen,
  t,
}: {
  agent: RealtorAgent;
  stage: RealtorLeadStatus;
  isGhost?: boolean;
  onOpen: (agent: RealtorAgent) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: agent.id,
    data: { type: 'card', status: stage, agent },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isGhost ? 'opacity-30' : isDragging ? 'opacity-40' : ''}
    >
      <div
        className={`w-full text-left bg-card border-l-4 ${stageColor[stage]} rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow flex gap-2`}
      >
        <button
          type="button"
          className="shrink-0 mt-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Drag ${agent.agentName}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={() => onOpen(agent)}
          className="flex-1 min-w-0 text-left"
        >
          <PipelineCardContent agent={agent} stage={stage} t={t} />
        </button>
      </div>
    </div>
  );
}

function PipelineCardContent({
  agent,
  stage,
  borderClass,
  isDragging,
  t,
}: {
  agent: RealtorAgent;
  stage: RealtorLeadStatus;
  borderClass?: string;
  isDragging?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div
      className={`${borderClass ? `border-l-4 ${borderClass} rounded-lg p-3 bg-card shadow-lg` : ''} ${
        isDragging ? 'rotate-2 scale-[1.02]' : ''
      }`}
    >
      <p className="text-sm font-bold text-foreground truncate">{agent.agentName}</p>
      <p className="text-[11px] text-muted-foreground truncate">{agent.brokerage}</p>
      <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
        <Home size={10} />
        <span className="truncate">
          {agent.latestPropertyAddress
            ? `${agent.latestPropertyAddress}${agent.latestCity ? `, ${agent.latestCity}` : ''}`
            : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-foreground font-medium">
          {agent.latestListPrice > 0 ? `$${(agent.latestListPrice / 1000).toFixed(0)}k` : '—'}
        </span>
        <span className="text-muted-foreground flex items-center gap-1">
          <Calendar size={10} /> {agent.latestDaysOnMarket > 0 ? `${agent.latestDaysOnMarket}d` : '—'}
        </span>
      </div>
      {agent.listingCount > 1 && (
        <span className="inline-block mt-1 text-[10px] text-speed">
          {t('realtorPipeline.priceDrops', { count: agent.listingCount - 1 })}
        </span>
      )}
    </div>
  );
}
