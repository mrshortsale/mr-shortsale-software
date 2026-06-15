import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createCountySource, deleteCountySource, getCountyScrapeRuns, getCountySources, runCountyScrape, toggleCountySourceActive, updateCountySource } from '@/services/countyScraper';
import type { CountyScrapeRun, CountySource, CreateCountySourceInput } from '@/types/countyScraper';
import AddCountySourceModal from './AddCountySourceModal';
import CountyScrapeHistory from './CountyScrapeHistory';

export default function CountySourcesSection() {
  const [sources, setSources] = useState<CountySource[]>([]);
  const [runs, setRuns] = useState<CountyScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CountySource | null>(null);

  const refresh = useCallback(async () => { setLoading(true); try { const [sourceData, runData] = await Promise.all([getCountySources(), getCountyScrapeRuns()]); setSources(sourceData); setRuns(runData); } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to load county sources'); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const saveSource = async (data: CreateCountySourceInput) => { try { if (editing) await updateCountySource(editing.id, data); else await createCountySource(data); toast.success('County source saved'); await refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to save county source'); } };
  const handleRun = async (source: CountySource) => { setRunningId(source.id); try { const run = await runCountyScrape(source.id); if (run.status === 'completed') toast.success(`✅ ${source.name}: ${run.records_inserted} leads imported`); else toast.error(`❌ Error: ${run.error_message ?? 'Scrape failed'}`); await refresh(); } catch (error) { toast.error(`❌ Error: ${error instanceof Error ? error.message : 'Scrape failed'}`); } finally { setRunningId(null); } };

  return <section className="space-y-6" aria-labelledby="county-sources-title"><Card><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle id="county-sources-title">County Data Sources</CardTitle><CardDescription>Register Florida clerk websites and import lis pendens filings into lead inventory.</CardDescription></div><Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add County</Button></CardHeader><CardContent>{loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading county sources...</div> : <Table><TableHeader><TableRow><TableHead>County Name</TableHead><TableHead>State</TableHead><TableHead>URL</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Last Scraped</TableHead><TableHead>Records Found</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{sources.map((source) => <TableRow key={source.id}><TableCell className="font-medium">{source.name}</TableCell><TableCell>{source.state}</TableCell><TableCell className="max-w-xs truncate"><a className="inline-flex items-center gap-1 text-primary hover:underline" href={source.scrape_url} target="_blank" rel="noreferrer">{source.scrape_url}<ExternalLink className="h-3 w-3" /></a></TableCell><TableCell><Badge variant="outline">{source.scrape_method === 'firecrawl' ? 'Firecrawl' : 'Apify'}</Badge></TableCell><TableCell><Switch checked={source.is_active} aria-label={`Toggle ${source.name}`} onCheckedChange={async (checked) => { await toggleCountySourceActive(source.id, checked); await refresh(); }} /></TableCell><TableCell>{source.last_scraped_at ? formatDistanceToNow(new Date(source.last_scraped_at), { addSuffix: true }) : 'Never'}</TableCell><TableCell>{source.last_record_count ?? 0}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" onClick={() => handleRun(source)} disabled={runningId === source.id}>{runningId === source.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Run Now</Button><Button size="sm" variant="outline" onClick={() => { setEditing(source); setModalOpen(true); }}>Edit</Button><Button size="sm" variant="ghost" onClick={async () => { await deleteCountySource(source.id); await refresh(); }} aria-label={`Delete ${source.name}`}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><CountyScrapeHistory runs={runs} /><AddCountySourceModal open={modalOpen} source={editing} onClose={() => setModalOpen(false)} onSave={saveSource} /></section>;
}
