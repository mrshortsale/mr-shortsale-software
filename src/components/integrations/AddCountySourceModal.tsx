import { FormEvent, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CountySource, CreateCountySourceInput } from '@/types/countyScraper';

interface Props { open: boolean; source?: CountySource | null; onClose: () => void; onSave: (data: CreateCountySourceInput) => Promise<void>; }

export default function AddCountySourceModal({ open, source, onClose, onSave }: Props) {
  const [form, setForm] = useState<CreateCountySourceInput>({ name: '', state: 'FL', scrape_url: '', scrape_method: 'firecrawl', schedule: 'daily', notes: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (source) setForm({ name: source.name, state: source.state, county_fips: source.county_fips, scrape_url: source.scrape_url, scrape_method: source.scrape_method, apify_actor_id: source.apify_actor_id, schedule: source.schedule, notes: source.notes }); }, [source]);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await onSave(form); onClose(); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{source ? 'Edit County Source' : 'Add County Source'}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4">
    <div className="grid gap-2"><Label htmlFor="county-name">County Name</Label><Input id="county-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
    <div className="grid gap-2 sm:grid-cols-2"><div><Label>State</Label><Select value={form.state} onValueChange={(state) => setForm({ ...form, state })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FL">Florida</SelectItem></SelectContent></Select></div><div><Label>Schedule</Label><Select value={form.schedule} onValueChange={(schedule: 'daily' | 'manual') => setForm({ ...form, schedule })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></div></div>
    <div className="grid gap-2"><Label htmlFor="scrape-url">Scrape URL</Label><Input id="scrape-url" type="url" value={form.scrape_url} onChange={(e) => setForm({ ...form, scrape_url: e.target.value })} required /></div>
    <div className="grid gap-2"><Label>Scrape Method</Label><Select value={form.scrape_method} onValueChange={(scrape_method: 'firecrawl' | 'apify') => setForm({ ...form, scrape_method })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="firecrawl">Firecrawl</SelectItem><SelectItem value="apify">Apify</SelectItem></SelectContent></Select></div>
    {form.scrape_method === 'apify' && <div className="grid gap-2"><Label htmlFor="apify-actor">Apify Actor ID</Label><Input id="apify-actor" value={form.apify_actor_id ?? ''} onChange={(e) => setForm({ ...form, apify_actor_id: e.target.value })} required /></div>}
    <div className="grid gap-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save source'}</Button></div>
  </form></DialogContent></Dialog>;
}
