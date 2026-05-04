import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  getInventoryLeads, inventoryCounts, InventoryLead, InventorySource,
} from '@/data/inventoryLeads';
import { useSavedViews } from '@/hooks/useSavedViews';
import SourceProvenance from '@/components/shared/SourceProvenance';
import { sendToMojo } from '@/integrations/mojoDialer';
import { toast } from 'sonner';
import {
  Search, Star, ArrowUpToLine, UserPlus, ArrowRightCircle, EyeOff,
  Flame, Filter, X, Globe,
} from 'lucide-react';

const STATES = ['All', 'FL', 'TX', 'CA', 'AZ', 'NV', 'GA', 'NC', 'IL', 'NY', 'OH'];

export default function LeadInventory() {
  const allLeads = useMemo(() => getInventoryLeads(), []);
  const counts = useMemo(() => inventoryCounts(), []);
  const { views } = useSavedViews();

  const [source, setSource] = useState<InventorySource | 'All'>('All');
  const [state, setState] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState(7);
  const [esOnly, setEsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLeads.filter(l => {
      if (hidden.has(l.id)) return false;
      if (source !== 'All' && l.source !== source) return false;
      if (state !== 'All' && l.state !== state) return false;
      if (esOnly && l.language !== 'ES') return false;
      if (!showAll && !(l.score >= minScore || l.daysToAuction <= 30)) return false;
      if (q && !(l.owner.toLowerCase().includes(q) || l.address.toLowerCase().includes(q) || l.county.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b.score - a.score || a.daysToAuction - b.daysToAuction);
  }, [allLeads, hidden, source, state, esOnly, showAll, minScore, search]);

  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  const toggleSel = (id: string) =>
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAllVisible = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.slice(0, 500).map(l => l.id))); // cap bulk select
  };

  const applyView = (filters: Record<string, unknown>) => {
    if ('state' in filters) setState(filters.state as string);
    if ('language' in filters) setEsOnly(filters.language === 'ES');
    if ('minScore' in filters) setMinScore(filters.minScore as number);
    if ('maxAuction' in filters) { setMinScore(0); setShowAll(true); }
  };

  const bulkPushMojo = () => {
    sendToMojo([...selected]).then(r =>
      toast.success(`${r.queued} leads queued in Mojo`, { description: 'Mojo will dial in order, top first.' })
    );
    setSelected(new Set());
  };
  const bulkPromote = () => {
    toast.success(`${selected.size} leads promoted to Active Pipeline`);
    setHidden(p => new Set([...p, ...selected]));
    setSelected(new Set());
  };
  const bulkAssign = () => toast(`Assign ${selected.size} leads — pick a rep…`);
  const bulkDismiss = () => {
    setHidden(p => new Set([...p, ...selected]));
    toast(`${selected.size} leads moved to Dismissed`);
    setSelected(new Set());
  };

  return (
    <div className="space-y-3">
      <SourceProvenance
        chips={[
          { source: 'Batch', count: counts.Batch.toLocaleString(), lastSync: '2h ago', status: 'pending' },
          { source: 'Zillow', count: counts.Zillow.toLocaleString(), lastSync: '12m ago', status: 'pending' },
          { source: 'Meta', count: counts.Meta.toLocaleString(), lastSync: 'live', status: 'live' },
        ]}
      />

      {/* Headline counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Counter label="Total inventory" value={counts.total.toLocaleString()} />
        <Counter label="Triage queue" value={counts.triage.toLocaleString()} accent="primary" />
        <Counter label="Hot (score ≥8)" value={counts.hot.toLocaleString()} accent="speed" />
        <Counter label="Selected" value={selected.size.toLocaleString()} accent="accent" />
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2 top-2.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search owner, address, county…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border rounded-md bg-muted outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Select value={source} onChange={v => setSource(v as InventorySource | 'All')} options={['All', 'Batch', 'Zillow', 'Meta', 'Manual']} />
          <Select value={state} onChange={setState} options={STATES} />
          <label className="text-[11px] flex items-center gap-1.5 text-foreground">
            Score ≥
            <input type="number" min={0} max={10} value={minScore} onChange={e => setMinScore(+e.target.value)} className="w-12 px-1.5 py-1 text-xs border rounded-md bg-muted" />
          </label>
          <button
            onClick={() => setEsOnly(v => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${esOnly ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            <Globe size={11} /> ES only
          </button>
          <button
            onClick={() => setShowAll(v => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${showAll ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}
            title={showAll ? `Showing all ${counts.total.toLocaleString()}` : 'Showing triage queue only'}
          >
            <Filter size={11} /> {showAll ? `All ${counts.total.toLocaleString()}` : 'Triage only'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Saved views</span>
          {views.map(v => (
            <button key={v.id} onClick={() => applyView(v.filters)} className="px-2 py-0.5 rounded text-[11px] bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 flex items-center gap-1">
              <Star size={10} /> {v.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar (sticky when selected) */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 rounded-xl border-2 border-primary bg-primary text-primary-foreground px-3 py-2 flex flex-wrap items-center gap-2 shadow-md">
          <span className="text-xs font-bold">{selected.size} selected</span>
          <button onClick={bulkPushMojo} className="px-2.5 py-1 rounded bg-primary-foreground text-primary text-[11px] font-bold flex items-center gap-1"><ArrowUpToLine size={11} /> Push to Mojo</button>
          <button onClick={bulkAssign} className="px-2.5 py-1 rounded bg-primary-foreground/90 text-primary text-[11px] font-bold flex items-center gap-1"><UserPlus size={11} /> Assign rep</button>
          <button onClick={bulkPromote} className="px-2.5 py-1 rounded bg-accent text-accent-foreground text-[11px] font-bold flex items-center gap-1"><ArrowRightCircle size={11} /> Promote to Pipeline</button>
          <button onClick={bulkDismiss} className="px-2.5 py-1 rounded bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center gap-1"><EyeOff size={11} /> Dismiss</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto opacity-80 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* Virtualized table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[28px_1.6fr_2fr_56px_72px_64px_44px_44px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted font-bold border-b">
          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAllVisible} className="cursor-pointer" />
          <span>Owner</span>
          <span>Address</span>
          <span className="text-right">Eq%</span>
          <span className="text-right">Auction</span>
          <span className="text-right">Score</span>
          <span>Lang</span>
          <span>Src</span>
        </div>
        <div ref={parentRef} className="overflow-auto" style={{ height: 560 }}>
          <div style={{ height: v.getTotalSize(), position: 'relative' }}>
            {v.getVirtualItems().map(vi => {
              const lead = filtered[vi.index];
              const isSel = selected.has(lead.id);
              const hot = lead.score >= 8;
              return (
                <div
                  key={lead.id}
                  className={`grid grid-cols-[28px_1.6fr_2fr_56px_72px_64px_44px_44px] gap-2 px-3 items-center text-xs border-b hover:bg-muted/50 ${isSel ? 'bg-primary/5' : ''}`}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: vi.size, transform: `translateY(${vi.start}px)` }}
                >
                  <input type="checkbox" checked={isSel} onChange={() => toggleSel(lead.id)} className="cursor-pointer" />
                  <span className="truncate font-medium text-foreground flex items-center gap-1">
                    {hot && <Flame size={10} className="text-speed shrink-0" />}
                    {lead.owner}
                  </span>
                  <span className="truncate text-muted-foreground">{lead.address}, {lead.city}, {lead.state}</span>
                  <span className={`text-right font-mono ${lead.equityPct <= 15 ? 'text-destructive' : 'text-foreground'}`}>{lead.equityPct}</span>
                  <span className={`text-right font-mono ${lead.daysToAuction <= 30 ? 'text-speed font-bold' : 'text-muted-foreground'}`}>{lead.daysToAuction}d</span>
                  <span className="text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${lead.score >= 8 ? 'bg-speed text-white' : lead.score >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      {lead.score}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">{lead.language}</span>
                  <span className="text-[10px] text-muted-foreground">{lead.source}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="px-3 py-2 text-[11px] text-muted-foreground bg-muted border-t flex items-center justify-between">
          <span>Showing {filtered.length.toLocaleString()} of {counts.total.toLocaleString()} · virtualized</span>
          {hidden.size > 0 && <button onClick={() => setHidden(new Set())} className="text-primary font-bold hover:underline">Restore {hidden.size} dismissed</button>}
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, accent }: { label: string; value: string; accent?: 'primary' | 'speed' | 'accent' }) {
  const border =
    accent === 'speed' ? 'border-l-speed' :
    accent === 'accent' ? 'border-l-accent' :
    accent === 'primary' ? 'border-l-primary' : 'border-l-muted-foreground/30';
  return (
    <div className={`metric-card border-l-4 ${border}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="px-2 py-1.5 text-xs border rounded-md bg-muted outline-none">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
