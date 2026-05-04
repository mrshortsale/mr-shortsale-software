import { useEffect, useState } from 'react';

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
}

const KEY = 'mss.savedViews.inventory';

export function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setViews(JSON.parse(raw));
      else setViews(DEFAULTS);
    } catch { setViews(DEFAULTS); }
  }, []);

  const save = (v: SavedView) => {
    setViews(prev => {
      const next = [...prev.filter(p => p.id !== v.id), v];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  const remove = (id: string) => {
    setViews(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  return { views, save, remove };
}

const DEFAULTS: SavedView[] = [
  { id: 'hot-fl', name: 'Hot FL', filters: { state: 'FL', minScore: 8 } },
  { id: 'es-equity', name: 'ES + high equity', filters: { language: 'ES', minEquity: 30 } },
  { id: 'auction-soon', name: 'Auction ≤ 30d', filters: { maxAuction: 30 } },
];
