import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserMinus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchReps, type InventoryRep } from '@/services/inventory';

interface Props {
  trigger: React.ReactNode;
  /** Called with the chosen rep ID, or null to unassign. */
  onPick: (repId: string | null) => void;
  /** Optional: hide the "Unassign" option (e.g. when no leads are currently assigned). */
  allowUnassign?: boolean;
}

export default function InventoryRepPicker({ trigger, onPick, allowUnassign = true }: Props) {
  const [open, setOpen] = useState(false);
  const [reps, setReps] = useState<InventoryRep[] | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || reps) return;
    setLoading(true);
    fetchReps().then(({ reps, error }) => {
      if (error) console.error(error);
      setReps(reps ?? []);
      setLoading(false);
    });
  }, [open, reps]);

  const filtered = useMemo(() => {
    if (!reps) return [];
    const s = q.trim().toLowerCase();
    if (!s) return reps;
    return reps.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
  }, [reps, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="px-2 py-1.5 border-b mb-1 flex items-center gap-1.5">
          <Search size={12} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rep…"
            className="flex-1 text-xs bg-transparent outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No reps available</p>
          )}
          {!loading && filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setOpen(false); onPick(r.id); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted"
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: r.avatar_color || '#185FA5' }}
              >
                {r.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1 text-left">
                <span className="block font-medium text-foreground">{r.name}</span>
                <span className="block text-[10px] text-muted-foreground">{r.email}</span>
              </span>
            </button>
          ))}
        </div>
        {allowUnassign && (
          <button
            type="button"
            onClick={() => { setOpen(false); onPick(null); }}
            className="w-full mt-1 px-2 py-1.5 text-xs rounded border-t hover:bg-muted text-amber-600 flex items-center gap-2"
          >
            <UserMinus size={12} /> Unassign
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
