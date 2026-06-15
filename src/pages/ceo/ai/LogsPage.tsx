import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listRuns, listLogs, type AgentRun, type AgentLog } from '@/services/aiAgents';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

const AGENT_LABELS: Record<string, string> = {
  'lead-hunter': 'Lead Hunter',
  'research': 'Research',
  'scoring': 'Scoring',
  'script-skip': 'Script & Skip',
};

function statusClass(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'running': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ---- Runs tab ----

function RunsTab() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [, setSearchParams] = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetch = useCallback(async () => {
    setLoading(true);
    const { runs: data, total: count, error } = await listRuns({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    if (error) {
      toast.error(error);
    } else {
      setRuns(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  const runDuration = (run: AgentRun): string => {
    if (!run.completed_at) return '—';
    const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
    return formatDuration(ms);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{total.toLocaleString()} total runs</p>
        <Button variant="ghost" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[1.5fr_88px_60px_80px_80px_auto] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted font-bold border-b">
          <span>Started</span>
          <span>Status</span>
          <span>Leads</span>
          <span>Duration</span>
          <span>Tokens</span>
          <span>Logs</span>
        </div>

        {loading && runs.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No pipeline runs yet. Go to Agents and click Run Now.
          </div>
        )}

        {runs.map((run) => {
          const totalTokens = run.summary
            ? Object.values(run.summary).reduce<number>((sum, v) => {
                const val = v as { tokens?: number };
                return sum + (val?.tokens || 0);
              }, 0)
            : null;

          return (
            <div
              key={run.id}
              className="grid grid-cols-[1.5fr_88px_60px_80px_80px_auto] gap-2 px-3 py-2.5 text-xs border-b last:border-b-0 items-center hover:bg-muted/40"
            >
              <span className="font-mono text-[11px]">{formatDate(run.started_at)}</span>
              <Badge className={`text-[10px] border-0 w-fit ${statusClass(run.status)}`}>
                {run.status}
              </Badge>
              <span className="tabular-nums font-medium">{run.lead_limit}</span>
              <span className="text-muted-foreground">{runDuration(run)}</span>
              <span className="text-muted-foreground tabular-nums">
                {totalTokens ? totalTokens.toLocaleString() : '—'}
              </span>
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2 hover:no-underline"
                onClick={() => setSearchParams({ tab: 'logs', runId: run.id })}
              >
                View
              </button>
            </div>
          );
        })}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Logs tab ----

function LogRow({ log }: { log: AgentLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        className="grid grid-cols-[1.4fr_100px_96px_72px_72px_24px] gap-2 px-3 py-2.5 text-xs border-b last:border-b-0 items-center hover:bg-muted/40 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="font-mono text-[11px]">{formatDate(log.created_at)}</span>
        <Badge className={`text-[10px] border-0 w-fit ${statusClass(log.status)}`}>
          {log.status}
        </Badge>
        <span className="font-medium truncate">{AGENT_LABELS[log.agent_slug] ?? log.agent_slug}</span>
        <span className="text-muted-foreground tabular-nums">{formatDuration(log.duration_ms)}</span>
        <span className="text-muted-foreground tabular-nums">
          {log.token_usage ? log.token_usage.total.toLocaleString() : '—'}
        </span>
        <span className="text-muted-foreground">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </div>

      {expanded && (
        <div className="border-b bg-muted/30 px-3 py-3 space-y-3 text-xs">
          {log.error_message && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <p className="font-semibold text-red-700 dark:text-red-400 mb-0.5">Error</p>
              <p className="text-red-600 dark:text-red-300 font-mono">{log.error_message}</p>
            </div>
          )}

          {log.input_summary && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Input</p>
              <pre className="whitespace-pre-wrap text-[11px] font-mono text-foreground bg-background border rounded p-2 overflow-auto max-h-40">
                {log.input_summary}
              </pre>
            </div>
          )}

          {log.output_summary && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Output</p>
              <pre className="whitespace-pre-wrap text-[11px] font-mono text-foreground bg-background border rounded p-2 overflow-auto max-h-60">
                {log.output_summary}
              </pre>
            </div>
          )}

          {log.token_usage && (
            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span>Prompt: <strong className="text-foreground">{log.token_usage.prompt.toLocaleString()}</strong></span>
              <span>Completion: <strong className="text-foreground">{log.token_usage.completion.toLocaleString()}</strong></span>
              <span>Total: <strong className="text-foreground">{log.token_usage.total.toLocaleString()}</strong></span>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground font-mono">
            run: {log.run_id.slice(0, 8)}... · log: {log.id.slice(0, 8)}...
          </p>
        </div>
      )}
    </>
  );
}

const AGENT_SLUGS = ['', 'lead-hunter', 'research', 'scoring', 'script-skip'];

function LogsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const runIdFilter = searchParams.get('runId') || '';
  const agentFilter = searchParams.get('agentSlug') || '';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetch = useCallback(async () => {
    setLoading(true);
    const { logs: data, total: count, error } = await listLogs({
      runId: runIdFilter || undefined,
      agentSlug: agentFilter || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    if (error) {
      toast.error(error);
    } else {
      setLogs(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [runIdFilter, agentFilter, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const clearFilter = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    next.set('tab', 'logs');
    setSearchParams(next);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">{total.toLocaleString()} logs</p>

        {runIdFilter && (
          <Badge variant="outline" className="gap-1 text-xs cursor-pointer" onClick={() => clearFilter('runId')}>
            Run: {runIdFilter.slice(0, 8)}... ×
          </Badge>
        )}

        <select
          value={agentFilter}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (e.target.value) next.set('agentSlug', e.target.value);
            else next.delete('agentSlug');
            next.set('tab', 'logs');
            setSearchParams(next);
            setPage(1);
          }}
          className="h-7 rounded-md border bg-background px-2 text-xs outline-none"
        >
          <option value="">All agents</option>
          {AGENT_SLUGS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{AGENT_LABELS[s] ?? s}</option>
          ))}
        </select>

        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetch} disabled={loading}>
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[1.4fr_100px_96px_72px_72px_24px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted font-bold border-b">
          <span>Timestamp</span>
          <span>Status</span>
          <span>Agent</span>
          <span>Duration</span>
          <span>Tokens</span>
          <span />
        </div>

        {loading && logs.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No logs yet. Run the pipeline to see agent execution logs here.
          </div>
        )}

        {logs.map((log) => <LogRow key={log.id} log={log} />)}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'runs';

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs & Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Agent pipeline run history and per-agent execution logs, newest first.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {['runs', 'logs'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(tab)}
          >
            {tab === 'runs' ? 'Runs' : 'Logs'}
          </button>
        ))}
      </div>

      {activeTab === 'runs' ? <RunsTab /> : <LogsTab />}
    </div>
  );
}
