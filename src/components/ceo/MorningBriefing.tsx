import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Users, Phone, Bot, CheckSquare, Square, AlertTriangle, Sparkles } from 'lucide-react';
import { aiInboundCalls } from '@/data/calls';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import AIActivityTicker from './AIActivityTicker';
import SpeedToLeadFeed from '@/components/shared/SpeedToLeadFeed';
import { useLiveLeadFeed } from '@/hooks/useLiveSimulation';

const pipelineData = [
  { name: 'Initial Contact', count: 5 },
  { name: 'Docs Collected', count: 3 },
  { name: 'Bank Submitted', count: 3 },
  { name: 'Pending Approval', count: 1 },
];

const teamData = [
  { name: 'Maria', calls: 14 },
  { name: 'James', calls: 11 },
  { name: 'Luis', calls: 6 },
];

const tasks = [
  { text: 'Review 47 new leads from Realie.ai', done: true },
  { text: 'Approve AI call scripts — Westchester batch', done: true },
  { text: 'Follow up: Lopez file — auction in 28 days', done: false, priority: 'urgent' },
  { text: 'Review 6 AI call transcripts from last night', done: false, priority: 'new' },
  { text: 'Send DocuSign to Rodriguez family', done: false },
];

const recentAICalls = aiInboundCalls.slice(0, 3);

export default function MorningBriefing() {
  const [newLeads, setNewLeads] = useState(47);
  const [callsCompleted, setCallsCompleted] = useState(31);
  const { t } = useTranslation();

  useLiveLeadFeed(() => setNewLeads(n => n + 1));

  // Simulate calls ticking up occasionally
  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() > 0.5) setCallsCompleted(c => c + 1);
    }, 14000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title={t('briefing.newLeadsToday')} value={String(newLeads)} subtitle={t('briefing.newLeadsSubtitle')} icon={<ArrowUp className="text-accent" size={20} />} accent="accent" pulse />
        <MetricCard title={t('briefing.equityQualified')} value="18" subtitle={t('briefing.readyToCall')} icon={<Users className="text-secondary" size={20} />} accent="secondary" />
        <MetricCard title={t('briefing.callsCompleted')} value={String(callsCompleted)} subtitle={t('briefing.callsCompletedSubtitle')} icon={<Phone className="text-primary" size={20} />} accent="primary" />
        <MetricCard title={t('briefing.aiInboundHandled')} value="6" subtitle={t('briefing.aiInboundSubtitle')} icon={<Bot size={20} />} accent="warning" />
      </div>

      {/* Speed-to-Lead live feed (Meta Ads) */}
      <SpeedToLeadFeed compact />

      {/* Live AI Activity ticker */}
      <AIActivityTicker />

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <h3 className="font-bold text-foreground mb-4">{t('briefing.activePipeline')}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={pipelineData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                {pipelineData.map((_, i) => (
                  <Cell key={i} fill={['hsl(212,70%,37%)', 'hsl(160,75%,24%)', 'hsl(36,80%,28%)', 'hsl(210,93%,17%)'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">{t('briefing.pipelineNote')}</p>
        </div>

        <div className="metric-card">
          <h3 className="font-bold text-foreground mb-4">{t('briefing.taskChecklist')}</h3>
          <div className="space-y-3">
            {tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-3">
                {task.done ? <CheckSquare size={18} className="text-accent mt-0.5 shrink-0" /> : <Square size={18} className="text-muted-foreground mt-0.5 shrink-0" />}
                <span className={`text-sm ${task.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.text}</span>
                {task.priority === 'urgent' && <span className="badge-urgent shrink-0"><AlertTriangle size={10} className="mr-1" />{t('briefing.urgent')}</span>}
                {task.priority === 'new' && <span className="badge-en shrink-0"><Sparkles size={10} className="mr-1" />{t('briefing.new')}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <h3 className="font-bold text-foreground mb-4">{t('briefing.teamPerformanceToday')}</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={teamData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
              <Bar dataKey="calls" radius={[0, 6, 6, 0]} fill="hsl(212,70%,37%)" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">{t('briefing.teamNote')}</p>
        </div>

        <div className="metric-card">
          <h3 className="font-bold text-foreground mb-4">{t('briefing.aiInboundLast24')}</h3>
          <div className="space-y-3">
            {recentAICalls.map(call => (
              <div key={call.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Bot size={16} className="text-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{call.caller}</p>
                  <p className="text-xs text-muted-foreground truncate">{call.ai_summary.slice(0, 60)}…</p>
                </div>
                <span className={call.language === 'ES' ? 'badge-es' : 'badge-en'}>{call.language}</span>
                <span className={call.outcome.includes('Qualified') ? 'badge-qualified' : call.outcome.includes('Not') ? 'badge-urgent' : 'badge-pending'}>{call.outcome}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, accent, pulse }: { title: string; value: string; subtitle: string; icon: React.ReactNode; accent: string; pulse?: boolean }) {
  const borderColor = accent === 'accent' ? 'border-l-accent' : accent === 'secondary' ? 'border-l-secondary' : accent === 'warning' ? 'border-l-warning' : 'border-l-primary';
  return (
    <div className={`metric-card border-l-4 ${borderColor} relative overflow-hidden`}>
      {pulse && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent animate-ping" />}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon}
      </div>
      <p key={value} className="text-3xl font-bold text-foreground animate-count-up">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
