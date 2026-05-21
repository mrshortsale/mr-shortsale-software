import { Columns3, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface InventoryColumn {
  id: string;
  label: string;
  /** Always visible — cannot be toggled off. */
  required?: boolean;
  /** Default visibility for non-required columns. */
  default?: boolean;
}

export const INVENTORY_COLUMNS: InventoryColumn[] = [
  // Required / always visible
  { id: 'select', label: 'Select', required: true },
  { id: 'score', label: 'Urgency Score', required: true },
  { id: 'owner', label: 'Owner', required: true },
  { id: 'address', label: 'Address', required: true },
  // Default visible (per spec - 13 total with the required ones)
  { id: 'phone', label: 'Phone', default: true },
  { id: 'leadType', label: 'Lead Type', default: true },
  { id: 'source', label: 'Source', default: true },
  { id: 'equity', label: 'Equity %', default: true },
  { id: 'filing', label: 'Filing Type', default: true },
  { id: 'auction', label: 'Days to Auction', default: true },
  { id: 'rep', label: 'Assigned Rep', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'dateAdded', label: 'Date Added', default: true },
  // Secondary (hidden by default)
  { id: 'apn', label: 'APN' },
  { id: 'email', label: 'Email' },
  { id: 'ltv', label: 'LTV %' },
  { id: 'attempts', label: 'Contact Attempts' },
  { id: 'lastContact', label: 'Last Contact' },
  { id: 'lastOutcome', label: 'Last Outcome' },
  { id: 'city', label: 'City' },
  { id: 'county', label: 'County' },
  { id: 'language', label: 'Language' },
  { id: 'batchList', label: 'Batch List' },
];

export const DEFAULT_VISIBLE = new Set(
  INVENTORY_COLUMNS.filter((c) => c.required || c.default).map((c) => c.id),
);

const STORAGE_KEY = 'inventory.columns.v1';

export function loadVisibleColumns(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE);
    const arr = JSON.parse(raw) as string[];
    const next = new Set(arr);
    // Always include required columns
    for (const c of INVENTORY_COLUMNS) if (c.required) next.add(c.id);
    return next;
  } catch {
    return new Set(DEFAULT_VISIBLE);
  }
}

export function saveVisibleColumns(visible: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visible]));
  } catch { /* ignore */ }
}

interface Props {
  visible: Set<string>;
  onChange: (next: Set<string>) => void;
}

// Maps column IDs that don't match translation key names to their actual keys
const COLUMN_KEY_MAP: Record<string, string> = {
  score: 'urgencyScore',
  equity: 'equityPct',
  filing: 'filingType',
  auction: 'daysToAuction',
  rep: 'assignedRep',
  ltv: 'ltvPct',
  attempts: 'contactAttempts',
};

export function getColumnTranslationKey(id: string): string {
  return `inventory.columns.${COLUMN_KEY_MAP[id] ?? id}`;
}

export default function InventoryColumnPicker({ visible, onChange }: Props) {
  const { t } = useTranslation();
  const toggle = (id: string) => {
    const col = INVENTORY_COLUMNS.find((c) => c.id === id);
    if (col?.required) return;
    const next = new Set(visible);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
    saveVisibleColumns(next);
  };

  const reset = () => {
    onChange(new Set(DEFAULT_VISIBLE));
    saveVisibleColumns(DEFAULT_VISIBLE);
  };

  const visibleCount = INVENTORY_COLUMNS.filter((c) => !c.required && visible.has(c.id)).length;
  const totalToggleable = INVENTORY_COLUMNS.filter((c) => !c.required).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="px-2 py-1.5 text-xs border rounded-md bg-muted text-foreground flex items-center gap-1.5 hover:bg-muted/80"
          title="Show or hide columns"
        >
          <Columns3 size={12} /> Columns
          <span className="text-[10px] text-muted-foreground">{visibleCount}/{totalToggleable}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="flex items-center justify-between px-2 py-1.5 border-b mb-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Columns</span>
          <button onClick={reset} className="text-[10px] text-primary font-bold hover:underline">
            Reset
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {INVENTORY_COLUMNS.filter((c) => c.id !== 'select').map((c) => {
            const checked = visible.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                disabled={c.required}
                className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-muted ${c.required ? 'opacity-60 cursor-default' : ''}`}
              >
                <span className="text-foreground">{t(getColumnTranslationKey(c.id), c.label)}</span>
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                  {checked && <Check size={10} className="text-primary-foreground" />}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
