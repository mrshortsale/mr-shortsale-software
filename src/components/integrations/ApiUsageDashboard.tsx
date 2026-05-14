import { useState, useEffect, useMemo } from 'react';
import { Activity, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getApiUsage, type ApiLogEntry, type Integration } from '@/services/integrations';
import { toast } from 'sonner';

interface Props {
  integrations: Integration[];
}

export default function ApiUsageDashboard({ integrations }: Props) {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterIntegration, setFilterIntegration] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7d');

  useEffect(() => {
    fetchLogs();
  }, [filterIntegration]);

  const fetchLogs = async () => {
    setLoading(true);
    const params: { integrationId?: string; limit?: number } = { limit: 500 };
    if (filterIntegration !== 'all') params.integrationId = filterIntegration;

    const { logs: data, error } = await getApiUsage(params);
    if (error) {
      toast.error(error);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const ranges: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - (ranges[timeRange] || ranges['7d']);
    return logs.filter((l) => new Date(l.created_at).getTime() >= cutoff);
  }, [logs, timeRange]);

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const errors = filteredLogs.filter((l) => l.status_code && l.status_code >= 400).length;
    const avgLatency = total > 0
      ? Math.round(filteredLogs.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / total)
      : 0;
    const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : '0';
    return { total, errors, avgLatency, errorRate };
  }, [filteredLogs]);

  const chartData = useMemo(() => {
    const buckets = new Map<string, { date: string; calls: number; errors: number }>();
    for (const log of filteredLogs) {
      const date = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = buckets.get(date) || { date, calls: 0, errors: 0 };
      existing.calls++;
      if (log.status_code && log.status_code >= 400) existing.errors++;
      buckets.set(date, existing);
    }
    return Array.from(buckets.values());
  }, [filteredLogs]);

  const perIntegrationStats = useMemo(() => {
    const map = new Map<string, { name: string; calls: number; errors: number; totalLatency: number; lastCall: string }>();

    for (const log of filteredLogs) {
      const integ = integrations.find((i) => i.id === log.integration_id);
      const name = integ?.name || log.integration_id;
      const existing = map.get(log.integration_id) || { name, calls: 0, errors: 0, totalLatency: 0, lastCall: '' };
      existing.calls++;
      if (log.status_code && log.status_code >= 400) existing.errors++;
      existing.totalLatency += log.latency_ms || 0;
      if (!existing.lastCall || log.created_at > existing.lastCall) existing.lastCall = log.created_at;
      map.set(log.integration_id, existing);
    }

    return Array.from(map.values())
      .map((s) => ({ ...s, avgLatency: Math.round(s.totalLatency / s.calls) }))
      .sort((a, b) => b.calls - a.calls);
  }, [filteredLogs, integrations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">API Usage</h2>
            <p className="text-sm text-muted-foreground">Monitor API calls across all integrations.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterIntegration} onValueChange={setFilterIntegration}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All integrations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All integrations</SelectItem>
              {integrations.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Calls</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.errors}</p>
              <p className="text-xs text-muted-foreground">Errors ({stats.errorRate}%)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.avgLatency}ms</p>
              <p className="text-xs text-muted-foreground">Avg Latency</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{perIntegrationStats.length}</p>
              <p className="text-xs text-muted-foreground">Active Integrations</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calls Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Integration Breakdown */}
      {perIntegrationStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Per-Integration Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integration</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">Last Call</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perIntegrationStats.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.calls}</TableCell>
                    <TableCell className="text-right">
                      {s.errors > 0 ? (
                        <Badge variant="destructive" className="text-xs">{s.errors}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{s.avgLatency}ms</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(s.lastCall).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent API Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No API calls recorded yet.</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Integration</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead>Direction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 50).map((log) => {
                    const integ = integrations.find((i) => i.id === log.integration_id);
                    const isError = log.status_code && log.status_code >= 400;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{integ?.name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">{log.method}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs font-mono">{log.endpoint}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={`text-xs border-0 ${isError ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}
                          >
                            {log.status_code || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{log.latency_ms ? `${log.latency_ms}ms` : '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {log.direction === 'inbound' ? '← IN' : '→ OUT'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
