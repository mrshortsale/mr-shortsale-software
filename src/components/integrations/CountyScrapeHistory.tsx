import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CountyScrapeRun } from '@/types/countyScraper';

export default function CountyScrapeHistory({ runs }: { runs: CountyScrapeRun[] }) {
  return <Card><CardHeader><CardTitle>County Scrape History</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Run date</TableHead><TableHead>County</TableHead><TableHead>Status</TableHead><TableHead>Found</TableHead><TableHead>Inserted</TableHead><TableHead>Skipped</TableHead><TableHead>Duration</TableHead><TableHead>Raw preview</TableHead></TableRow></TableHeader><TableBody>{runs.map((run) => { const duration = run.completed_at ? `${Math.max(1, Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000))}s` : 'Running'; return <TableRow key={run.id}><TableCell>{formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</TableCell><TableCell>{run.county_sources?.name ?? 'County'}</TableCell><TableCell><Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>{run.status}</Badge></TableCell><TableCell>{run.records_found}</TableCell><TableCell>{run.records_inserted}</TableCell><TableCell>{run.records_skipped}</TableCell><TableCell>{duration}</TableCell><TableCell className="max-w-xs truncate" title={run.error_message ?? run.raw_preview ?? ''}>{run.error_message ?? run.raw_preview ?? '—'}</TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>;
}
