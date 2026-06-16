import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Database, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CountySource, CreateCountySourceInput, ScrapeMethod, ScrapeSchedule, CountyScrapeRun } from '@/types/countyScraper';
import { createCountySource, deleteCountySource, getCountySources, getScrapeRuns, runCountyScrape, toggleCountySourceActive, updateCountySource } from '@/services/countyScraper';

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const blankForm: CreateCountySourceInput = { name: '', state: 'FL', county_fips: '', scrape_url: '', scrape_method: 'firecrawl', apify_actor_id: '', schedule: 'daily', notes: '' };

function relativeTime(iso: string | null) {
  if (!iso) return 'Never';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function duration(run: CountyScrapeRun) {
  if (!run.completed_at) return '—';
  const seconds = Math.max(0, Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function DataSourcesPage() {
  const [sources, setSources] = useState<CountySource[]>([]);
  const [runs, setRuns] = useState<CountyScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CountySource | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateCountySourceInput>(blankForm);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const hasRunning = useMemo(() => (Array.isArray(runs) ? runs : []).some((run) => run.status === 'running'), [runs]);

  const refresh = useCallback(async () => {
    const [nextSources, nextRuns] = await Promise.all([getCountySources(), getScrapeRuns()]);
    setSources(Array.isArray(nextSources) ? nextSources : []);
    setRuns(Array.isArray(nextRuns) ? nextRuns : []);
  }, []);

  useEffect(() => {
    refresh().catch((error) => toast.error(error.message)).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!hasRunning && !runningId) return;
    const id = window.setInterval(() => refresh().catch(() => undefined), 3000);
    return () => window.clearInterval(id);
  }, [hasRunning, refresh, runningId]);

  const openCreate = () => { setEditing(null); setForm(blankForm); setModalOpen(true); };
  const openEdit = (source: CountySource) => {
    setEditing(source);
    setForm({ name: source.name, state: source.state, county_fips: source.county_fips ?? '', scrape_url: source.scrape_url, scrape_method: source.scrape_method, apify_actor_id: source.apify_actor_id ?? '', schedule: source.schedule, notes: source.notes ?? '' });
    setModalOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      new URL(form.scrape_url);
      if (editing) await updateCountySource(editing.id, form);
      else await createCountySource(form);
      toast.success(editing ? 'County source updated' : 'County source created');
      setModalOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save county source');
    }
  };

  const runNow = async (source: CountySource) => {
    setRunningId(source.id);
    try {
      const run = await runCountyScrape(source.id);
      await refresh();
      if (run.status === 'failed') toast.error(`❌ ${source.name}: ${run.error_message ?? 'Scrape failed'}`);
      else toast.success(`✅ ${source.name}: ${run.records_inserted} leads imported (${run.records_skipped} skipped)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Scrape failed');
    } finally {
      setRunningId(null);
      refresh().catch(() => undefined);
    }
  };

  const remove = async (source: CountySource) => {
    if (!window.confirm(`Delete ${source.name}? Scrape history for this source will also be deleted.`)) return;
    await deleteCountySource(source.id);
    toast.success('County source deleted');
    await refresh();
  };

  const toggleExpanded = (id: string) => setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return (
    <main className="space-y-6">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground"><Database size={20} /> County Data Sources</h1>
            <p className="text-sm text-muted-foreground">Manage county filing URLs and run scraper validation before leads enter inventory.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Add County</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted text-xs uppercase text-muted-foreground"><tr>{['County','State','URL','Method','Schedule','Active','Last Run','Records','Actions'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></td></tr>}
              {!loading && sources.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No county sources yet. Add your first county to start scraping leads.</td></tr>}
              {sources.map((source) => (
                <tr key={source.id} className="border-b last:border-0">
                  <td className="px-3 py-3 font-bold text-foreground">{source.name}</td><td className="px-3 py-3">{source.state}</td>
                  <td className="px-3 py-3"><a href={source.scrape_url} target="_blank" rel="noreferrer" className="text-primary hover:underline" title={source.scrape_url}>{source.scrape_url.length > 40 ? `${source.scrape_url.slice(0, 40)}…` : source.scrape_url}</a></td>
                  <td className="px-3 py-3"><Badge tone={source.scrape_method === 'firecrawl' ? 'blue' : 'orange'}>{source.scrape_method === 'firecrawl' ? 'Firecrawl' : 'Apify'}</Badge></td>
                  <td className="px-3 py-3 capitalize">{source.schedule}</td>
                  <td className="px-3 py-3"><input type="checkbox" checked={source.is_active} onChange={(e) => toggleCountySourceActive(source.id, e.target.checked).then(refresh)} aria-label={`Toggle ${source.name} active`} /></td>
                  <td className="px-3 py-3">{relativeTime(source.last_scraped_at)}</td><td className="px-3 py-3 font-mono">{source.last_record_count ?? 0}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><button disabled={runningId === source.id} onClick={() => runNow(source)} className="rounded border px-2 py-1 text-xs font-bold hover:bg-muted disabled:opacity-50">{runningId === source.id ? 'Running…' : 'Run Now'}</button><button onClick={() => openEdit(source)} aria-label={`Edit ${source.name}`}><Pencil size={15} /></button><button onClick={() => remove(source)} aria-label={`Delete ${source.name}`} className="text-destructive"><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-foreground">Scrape History</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-muted text-xs uppercase text-muted-foreground"><tr>{['County','Started','Status','Found','Inserted','Skipped','Duration','Details'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>{runs.map((run) => <RunRow key={run.id} run={run} expanded={expanded.has(run.id)} onToggle={() => toggleExpanded(run.id)} />)}</tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-bold">{editing ? 'Edit County' : 'Add County'}</h2>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="County Name*"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Miami-Dade" /></Field><Field label="State*"><select required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="County FIPS"><input value={form.county_fips} onChange={(e) => setForm({ ...form, county_fips: e.target.value })} placeholder="12086" /></Field><Field label="Scrape URL*"><input required type="url" value={form.scrape_url} onChange={(e) => setForm({ ...form, scrape_url: e.target.value })} /></Field><Field label="Scrape Method*"><select value={form.scrape_method} onChange={(e) => setForm({ ...form, scrape_method: e.target.value as ScrapeMethod })}><option value="firecrawl">Firecrawl</option><option value="apify">Apify</option></select></Field><Field label="Schedule*"><select value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value as ScrapeSchedule })}><option value="daily">Daily</option><option value="manual">Manual</option></select></Field>{form.scrape_method === 'apify' && <Field label="Apify Actor ID"><input value={form.apify_actor_id} onChange={(e) => setForm({ ...form, apify_actor_id: e.target.value })} /></Field>}<Field label="Notes" wide><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></Field></div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded border px-3 py-2 text-sm font-bold">Cancel</button><button type="submit" className="rounded bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">Save</button></div>
          </form>
        </div>
      )}
    </main>
  );
}

function RunRow({ run, expanded, onToggle }: { run: CountyScrapeRun; expanded: boolean; onToggle: () => void }) {
  return <><tr className="border-b"><td className="px-3 py-3 font-medium">{run.county_sources?.name ?? '—'}</td><td className="px-3 py-3">{relativeTime(run.started_at)}</td><td className="px-3 py-3"><Status status={run.status} /></td><td className="px-3 py-3">{run.records_found}</td><td className="px-3 py-3">{run.records_inserted}</td><td className="px-3 py-3">{run.records_skipped}</td><td className="px-3 py-3">{duration(run)}</td><td className="px-3 py-3"><button onClick={onToggle} className="inline-flex items-center gap-1 text-primary">{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Details</button></td></tr>{expanded && <tr className="border-b bg-muted/30"><td colSpan={8} className="space-y-3 px-6 py-4">{run.error_message && <p className="rounded border border-destructive/30 bg-destructive/5 p-2 text-destructive">{run.error_message}</p>}<pre className="max-h-44 overflow-auto rounded bg-background p-3 text-xs">{run.raw_preview || 'No raw preview captured.'}</pre><div className="rounded border bg-card p-3"><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Sample Records</p>{run.sample_records?.length ? <table className="w-full text-xs"><tbody>{run.sample_records.map((sample, i) => <tr key={i}><td className="py-1 font-medium">{sample.homeowner_name ?? '—'}</td><td>{sample.address ?? '—'}</td><td>{sample.filing_date ?? '—'}</td><td>{sample.urgency_score ?? '—'}</td></tr>)}</tbody></table> : <p className="text-xs text-muted-foreground">No inserted sample records.</p>}</div><Link to="/ceo/inventory?source=County" className="inline-flex rounded bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">View in Lead Inventory →</Link></td></tr>}</>;
}
function Status({ status }: { status: CountyScrapeRun['status'] }) { const tone = status === 'completed' ? 'green' : status === 'failed' ? 'red' : status === 'running' ? 'yellow' : 'gray'; return <Badge tone={tone}>{status === 'running' && <Loader2 size={12} className="mr-1 inline animate-spin" />}{status[0].toUpperCase() + status.slice(1)}</Badge>; }
function Badge({ tone, children }: { tone: 'blue'|'orange'|'green'|'red'|'yellow'|'gray'; children: React.ReactNode }) { const styles = { blue: 'bg-blue-100 text-blue-700', orange: 'bg-orange-100 text-orange-700', green: 'bg-emerald-100 text-emerald-700', red: 'bg-red-100 text-red-700', yellow: 'bg-yellow-100 text-yellow-800', gray: 'bg-gray-100 text-gray-700' }; return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${styles[tone]}`}>{children}</span>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactElement }) { return <label className={`space-y-1 text-sm font-medium ${wide ? 'sm:col-span-2' : ''}`}><span>{label}</span><div className="[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_select]:py-2 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2">{children}</div></label>; }
