import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ChevronRight, Cpu, Loader2, Play, Power, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listAgents, updateAgent, runPipeline, type AIAgent } from '@/services/aiAgents';
import { CEO_BASE } from '@/config/ceoNav';
import { toast } from 'sonner';

const MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1'];

const AGENT_ORDER_LABELS = ['1st', '2nd', '3rd', '4th'];

function PipelineConnector() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex flex-col items-center gap-0.5">
        <div className="h-4 w-px bg-border" />
        <ChevronRight className="h-3 w-3 rotate-90 text-muted-foreground" />
      </div>
    </div>
  );
}

interface AgentCardProps {
  agent: AIAgent;
  index: number;
  onSaved: (updated: AIAgent) => void;
}

function AgentCard({ agent, index, onSaved }: AgentCardProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? '');
  const [instructions, setInstructions] = useState(agent.instructions);
  const [model, setModel] = useState(agent.model);
  const [isEnabled, setIsEnabled] = useState(agent.is_enabled);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateAgent(agent.id, { name, description, instructions, model, is_enabled: isEnabled });
    setSaving(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success(`${name} saved`);
      setDirty(false);
      onSaved({ ...agent, name, description, instructions, model, is_enabled: isEnabled });
    }
  };

  const handleToggle = async () => {
    const next = !isEnabled;
    setIsEnabled(next);
    setDirty(true);
    const { error } = await updateAgent(agent.id, { is_enabled: next });
    if (error) {
      setIsEnabled(!next);
      toast.error(error);
    }
  };

  return (
    <Card className={`transition-opacity ${!isEnabled ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
              {AGENT_ORDER_LABELS[index]}
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{agent.name}</CardTitle>
              <p className="text-xs text-muted-foreground font-mono">{agent.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] ${isEnabled ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
            >
              {isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggle}
              title={isEnabled ? 'Disable agent' : 'Enable agent'}
            >
              <Power className={`h-3.5 w-3.5 ${isEnabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Select value={model} onValueChange={(v) => { setModel(v); markDirty(); }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Input
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            placeholder="Short description of what this agent does"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Instructions</Label>
          <Textarea
            value={instructions}
            onChange={(e) => { setInstructions(e.target.value); markDirty(); }}
            rows={6}
            className="text-xs font-mono resize-y"
            placeholder="System prompt / instructions for this agent"
          />
        </div>

        {dirty && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [leadLimit, setLeadLimit] = useState(10);
  const navigate = useNavigate();

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const { agents: data, error } = await listAgents();
    if (error) {
      toast.error(error);
    } else {
      setAgents(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleRun = async () => {
    setRunning(true);
    toast.info('Pipeline started — this may take 30–90 seconds...');
    const { runId, error } = await runPipeline(leadLimit);
    setRunning(false);

    if (error) {
      toast.error(error, { duration: 8000 });
      if (runId) {
        navigate(`${CEO_BASE}/ai/logs`);
      }
    } else {
      toast.success(`Pipeline completed! Run ID: ${runId?.slice(0, 8)}...`);
      navigate(`${CEO_BASE}/ai/logs`);
    }
  };

  const enabledCount = agents.filter((a) => a.is_enabled).length;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Configure the pipeline agents and trigger a run.{' '}
              <span className="font-medium text-primary">{enabledCount} of {agents.length} enabled</span>
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAgents} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Run Pipeline control */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <Bot className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Run Pipeline</p>
          <p className="text-xs text-muted-foreground">
            Runs all enabled agents in sequence: Lead Hunter → Research → Scoring → Script & Skip
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Leads</Label>
          <Select value={String(leadLimit)} onValueChange={(v) => setLeadLimit(Number(v))}>
            <SelectTrigger className="h-8 w-20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((n) => (
                <SelectItem key={n} value={String(n)} className="text-sm">{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleRun} disabled={running || loading || enabledCount === 0}>
            {running
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Play className="mr-1.5 h-3.5 w-3.5" />}
            {running ? 'Running...' : 'Run Now'}
          </Button>
        </div>
      </div>

      {/* Agent cards in pipeline order */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-1">
          {agents.map((agent, i) => (
            <div key={agent.id}>
              <AgentCard
                agent={agent}
                index={i}
                onSaved={(updated) =>
                  setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                }
              />
              {i < agents.length - 1 && <PipelineConnector />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
