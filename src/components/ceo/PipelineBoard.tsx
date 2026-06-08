import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  PIPELINE_STAGES,
  type InventoryLead,
  type PipelineStage,
} from '@/data/inventoryLeads';
import {
  assignRep,
  fetchAllPipelineLeads,
  fetchReps,
  formatLastSync,
  getBatchSyncStatus,
  resolvePipelineStage,
  setLeadStatus,
  setPipelineStage,
  type InventoryRep,
} from '@/services/inventory';
import { sendToMojo } from '@/integrations/mojoDialer';
import { CEO_BASE } from '@/config/ceoNav';
import { Calendar, GripVertical, Home, Loader2, RefreshCw, User, ArrowRightCircle } from 'lucide-react';
import { toast } from 'sonner';
import InventoryLeadDrawer, { scoreColor } from '@/components/ceo/InventoryLeadDrawer';
import SourceProvenance from '@/components/shared/SourceProvenance';

const stageColors: Record<PipelineStage, string> = {
  'Initial Contact': 'border-t-secondary',
  'Docs Collected': 'border-t-accent',
  'Bank Submitted': 'border-t-warning',
  'Pending Approval': 'border-t-primary',
};

const STAGE_KEYS: Record<PipelineStage, string> = {
  'Initial Contact': 'pipeline.stages.initialContact',
  'Docs Collected': 'pipeline.stages.docsCollected',
  'Bank Submitted': 'pipeline.stages.bankSubmitted',
  'Pending Approval': 'pipeline.stages.pendingApproval',
};

const STAGE_COLOR: Record<PipelineStage, string> = {
  'Initial Contact': 'bg-secondary/10 text-secondary border border-secondary/30',
  'Docs Collected': 'bg-accent/10 text-accent border border-accent/30',
  'Bank Submitted': 'bg-amber-100 text-amber-700 border border-amber-300',
  'Pending Approval': 'bg-emerald-100 text-emerald-700 border border-emerald-300',
};

export default function PipelineBoard() {
  const [leads, setLeads] = useState<InventoryLead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stageCounts, setStageCounts] = useState<Record<PipelineStage, number>>({
    'Initial Contact': 0,
    'Docs Collected': 0,
    'Bank Submitted': 0,
    'Pending Approval': 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reps, setReps] = useState<InventoryRep[]>([]);
  const [lastSyncLabel, setLastSyncLabel] = useState('—');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { t } = useTranslation();

  const repNameById = useMemo(
    () => new Map(reps.map(r => [r.id, r.name])),
    [reps],
  );

  const selected = leads.find(l => l.id === selectedId) ?? null;
  const draggingLead = useMemo(
    () => leads.find(l => l.id === draggingId) ?? null,
    [leads, draggingId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    fetchReps().then(({ reps: loaded }) => {
      if (loaded) setReps(loaded);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ leads: loaded, total, stageCounts: counts, error }, sync] = await Promise.all([
      fetchAllPipelineLeads(),
      getBatchSyncStatus(),
    ]);
    setLoading(false);

    if (error) {
      setLoadError(error);
      setLeads([]);
      setTotalCount(0);
      return;
    }

    setLoadError(null);
    setLeads(loaded);
    setTotalCount(total);
    setStageCounts(counts);
    setLastSyncLabel(formatLastSync(sync.data?.lastRun?.completed_at ?? sync.data?.lastRun?.started_at));
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchLead = (id: string, patch: Partial<InventoryLead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  const handlePipelineStageChange = async (lead: InventoryLead, stage: PipelineStage) => {
    const previous = { pipelineStage: lead.pipelineStage, status: lead.status };
    const status = stage === 'Initial Contact' || stage === 'Docs Collected' ? 'Contacted' : 'Promoted';
    patchLead(lead.id, { pipelineStage: stage, status });

    const { error } = await setPipelineStage([lead.id], stage);
    if (error) {
      patchLead(lead.id, previous);
      toast.error(error);
      return;
    }
    toast.success(`Moved to ${stage}`);
  };

  const handleAssignRep = async (lead: InventoryLead, repId: string | null) => {
    const previous = lead.assignedRepId;
    patchLead(lead.id, { assignedRepId: repId });
    const { error } = await assignRep([lead.id], repId);
    if (error) {
      patchLead(lead.id, { assignedRepId: previous });
      toast.error(error);
    }
  };

  const handleStatusChange = async (lead: InventoryLead, status: InventoryLead['status']) => {
    const { error } = await setLeadStatus([lead.id], status);
    if (error) {
      toast.error(error);
      return;
    }
    if (status === 'Dismissed' || status === 'New') {
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      setSelectedId(null);
      setTotalCount(prev => Math.max(0, prev - 1));
    } else {
      const pipelineStage =
        status === 'Contacted' ? 'Initial Contact' as const :
        status === 'Promoted' ? 'Bank Submitted' as const :
        lead.pipelineStage;
      patchLead(lead.id, { status, pipelineStage });
    }
    toast.success(`Status updated to ${status}`);
  };

  const handlePushToMojo = (lead: InventoryLead) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target: any = {
      id: lead.id,
      agentName: lead.owner,
      agentPhone: lead.phone ?? '',
      agentEmail: lead.email ?? '',
      brokerage: lead.source ?? '',
      latestPropertyAddress: lead.address,
      latestCity: lead.city,
      latestState: lead.state,
      latestListPrice: 0,
      latestDaysOnMarket: lead.daysToAuction,
      latestListingId: lead.apn || lead.externalId || lead.id,
      datasetId: 'inventory',
    };
    sendToMojo([target]).then((r) => {
      if (r.ok) toast.success(`Sent ${lead.owner} to Mojo`);
      else toast.error(r.errors[0] ?? 'Push failed');
    });
  };

  const resolveDropStage = (
    overId: string | number,
    overData: Record<string, unknown> | undefined,
  ): PipelineStage | null => {
    if (overData?.type === 'column' && typeof overData.stage === 'string') {
      return overData.stage as PipelineStage;
    }
    if (overData?.type === 'card' && typeof overData.stage === 'string') {
      return overData.stage as PipelineStage;
    }
    if (PIPELINE_STAGES.includes(overId as PipelineStage)) {
      return overId as PipelineStage;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => setDraggingId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const lead = leads.find(l => l.id === active.id);
    if (!lead) return;

    const newStage = resolveDropStage(over.id, over.data.current as Record<string, unknown> | undefined);
    if (!newStage || resolvePipelineStage(lead) === newStage) return;

    handlePipelineStageChange(lead, newStage);
  };

  const advancedCount = leads.filter(l => resolvePipelineStage(l) !== 'Initial Contact').length;

  return (
    <div className="space-y-4">
      <SourceProvenance
        chips={[{
          source: 'Batch',
          count: totalCount > 0 ? `${totalCount.toLocaleString()} active` : 'No pipeline leads',
          lastSync: lastSyncLabel,
          status: loadError ? 'pending' : totalCount > 0 ? 'connected' : 'pending',
        }]}
      />

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

      <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-foreground">{t('pipeline.title')}</span>
        <span className="text-muted-foreground">{t('pipeline.summary', { count: totalCount })}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-accent font-bold">
          <ArrowRightCircle size={12} /> {t('pipeline.promotedToday', { count: advancedCount })}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Same Batch leads as{' '}
        <Link to={`${CEO_BASE}/inventory`} className="text-secondary underline underline-offset-2">
          Lead Inventory
        </Link>
        , grouped by pipeline stage. Showing up to 100 cards per column (sorted by score). Drag to move stage.
      </p>

      {loading && (
        <div className="text-center py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading pipeline…
        </div>
      )}

      {!loading && !loadError && leads.length === 0 && (
        <div className="metric-card text-center py-10 space-y-2">
          <p className="font-semibold text-foreground">No active pipeline leads yet</p>
          <p className="text-sm text-muted-foreground">
            Leads from Batch sync appear here after the pipeline stage is set. Run a sync or open Lead Inventory if the board looks empty.
          </p>
          <Link
            to={`${CEO_BASE}/inventory`}
            className="inline-flex text-sm text-secondary underline underline-offset-2"
          >
            Go to Lead Inventory
          </Link>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {PIPELINE_STAGES.map(stage => (
              <PipelineColumn
                key={stage}
                stage={stage}
                label={t(STAGE_KEYS[stage])}
                leads={leads.filter(l => resolvePipelineStage(l) === stage)}
                totalInStage={stageCounts[stage]}
                repNameById={repNameById}
                draggingId={draggingId}
                onOpen={setSelectedId}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
            {draggingLead ? (
              <PipelineCardContent
                lead={draggingLead}
                stage={resolvePipelineStage(draggingLead)}
                repName={draggingLead.assignedRepId ? repNameById.get(draggingLead.assignedRepId) : undefined}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <p className="text-xs text-muted-foreground mt-4 text-center">
        {totalCount.toLocaleString()} active leads · Click any card for full detail
      </p>

      <InventoryLeadDrawer
        key={selectedId ?? 'none'}
        lead={selected}
        open={!!selectedId}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
        repNameById={repNameById}
        onAssignRep={handleAssignRep}
        onStatusChange={handleStatusChange}
        onPushToMojo={handlePushToMojo}
        pipelineStages={PIPELINE_STAGES}
        pipelineStage={selected ? resolvePipelineStage(selected) : undefined}
        stageColors={STAGE_COLOR}
        onPipelineStageChange={handlePipelineStageChange}
      />
    </div>
  );
}

function PipelineColumn({
  stage,
  label,
  leads,
  totalInStage,
  repNameById,
  draggingId,
  onOpen,
}: {
  stage: PipelineStage;
  label: string;
  leads: InventoryLead[];
  totalInStage: number;
  repNameById: Map<string, string>;
  draggingId: string | null;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { type: 'column', stage },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl transition-colors ${isOver ? 'ring-2 ring-primary bg-primary/5' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">{label}</h3>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full" title={totalInStage > leads.length ? `Showing ${leads.length} of ${totalInStage}` : undefined}>
          {totalInStage > leads.length ? `${leads.length}/${totalInStage}` : totalInStage}
        </span>
      </div>
      <div className="space-y-3 min-h-[320px]">
        {leads.map(lead => (
          <PipelineCard
            key={lead.id}
            lead={lead}
            stage={stage}
            repName={lead.assignedRepId ? repNameById.get(lead.assignedRepId) : undefined}
            isGhost={draggingId === lead.id}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function PipelineCard({
  lead,
  stage,
  repName,
  isGhost,
  onOpen,
}: {
  lead: InventoryLead;
  stage: PipelineStage;
  repName?: string;
  isGhost?: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { type: 'card', stage, lead },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isGhost ? 'opacity-30' : isDragging ? 'opacity-40' : ''}
    >
      <div className={`w-full text-left metric-card border-t-4 ${stageColors[stage]} hover:shadow-md transition-shadow flex gap-2`}>
        <button
          type="button"
          className="shrink-0 mt-3 ml-1 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Drag ${lead.owner}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={() => onOpen(lead.id)}
          className="flex-1 min-w-0 text-left py-3 pr-3"
        >
          <PipelineCardContent lead={lead} stage={stage} repName={repName} />
        </button>
      </div>
    </div>
  );
}

function PipelineCardContent({
  lead,
  stage,
  repName,
  isDragging,
}: {
  lead: InventoryLead;
  stage: PipelineStage;
  repName?: string;
  isDragging?: boolean;
}) {
  const contactPct = Math.min(100, (lead.contactAttempts ?? 0) * 25);

  return (
    <div className={isDragging ? 'rotate-2 scale-[1.02] bg-card rounded-lg p-3 shadow-lg' : ''}>
      <div className="flex items-center gap-2">
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${scoreColor(lead.score)}`}>
          {lead.score}
        </span>
        <p className="text-sm font-bold text-foreground truncate">{lead.owner}</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1 truncate">{lead.address}, {lead.city}</p>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Home size={10} /> {lead.filingType ?? '—'}
        </span>
        <span className={`px-1.5 py-0.5 rounded ${lead.equityPct <= 15 ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>
          {lead.equityPct}%
        </span>
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-muted-foreground flex items-center gap-1">
          <Calendar size={10} /> {lead.daysToAuction}d to auction
        </span>
        <span className="text-foreground font-medium">{lead.status}</span>
      </div>
      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
          <span>{lead.contactAttempts ?? 0} contact attempt{(lead.contactAttempts ?? 0) !== 1 ? 's' : ''}</span>
          <span>{stage}</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${contactPct}%` }} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 truncate">
        <User size={10} className="inline mr-1" />
        {repName ?? 'Unassigned'} · {lead.source}
      </p>
    </div>
  );
}
