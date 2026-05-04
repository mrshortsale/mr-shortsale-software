import { Database, Building2, Facebook, Layers, ArrowRight } from 'lucide-react';
import { ReactNode } from 'react';

export type ProvenanceSource = 'Batch' | 'Zillow' | 'Meta' | 'ATOM';

interface ChipDef {
  source: ProvenanceSource;
  count?: string | number;
  lastSync: string;
  status?: 'live' | 'ok' | 'pending' | 'pilot';
}

interface Props {
  chips: ChipDef[];
  onOpenSources?: () => void;
}

const ICONS: Record<ProvenanceSource, ReactNode> = {
  Batch: <Database size={12} />,
  Zillow: <Building2 size={12} />,
  Meta: <Facebook size={12} />,
  ATOM: <Layers size={12} />,
};

const STATUS_DOT: Record<NonNullable<ChipDef['status']>, string> = {
  live: 'bg-speed animate-pulse',
  ok: 'bg-accent',
  pending: 'bg-amber-500',
  pilot: 'bg-secondary',
};

export default function SourceProvenance({ chips, onOpenSources }: Props) {
  return (
    <div className="rounded-xl bg-card border px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Data sources</span>
      {chips.map(c => (
        <span key={c.source} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-foreground">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status ?? 'ok']}`} />
          <span className="text-muted-foreground">{ICONS[c.source]}</span>
          <strong>{c.source}</strong>
          {c.count !== undefined && <span className="text-muted-foreground">· {c.count}</span>}
          <span className="text-muted-foreground">· {c.lastSync}</span>
        </span>
      ))}
      {onOpenSources && (
        <button
          onClick={onOpenSources}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary font-bold hover:underline"
        >
          Open Data Sources <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}
