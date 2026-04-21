import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import AgentDrillDown from './AgentDrillDown';

type Period = 'today' | 'week' | 'month';

const agentStats: Record<Period, { name: string; calls: number; connected: number; qualified: number; convRate: string; avgDuration: string }[]> = {
  today: [
    { name: 'Maria Santos', calls: 14, connected: 7, qualified: 3, convRate: '21%', avgDuration: '4m 12s' },
    { name: 'James Rivera', calls: 11, connected: 5, qualified: 2, convRate: '18%', avgDuration: '3m 45s' },
    { name: 'Luis Ortega', calls: 6, connected: 2, qualified: 1, convRate: '17%', avgDuration: '5m 02s' },
    { name: 'AI Voice Agent', calls: 6, connected: 6, qualified: 2, convRate: '33%', avgDuration: '3m 18s' },
  ],
  week: [
    { name: 'Maria Santos', calls: 68, connected: 34, qualified: 14, convRate: '21%', avgDuration: '4m 05s' },
    { name: 'James Rivera', calls: 52, connected: 24, qualified: 9, convRate: '17%', avgDuration: '3m 50s' },
    { name: 'Luis Ortega', calls: 30, connected: 12, qualified: 5, convRate: '17%', avgDuration: '4m 48s' },
    { name: 'AI Voice Agent', calls: 28, connected: 28, qualified: 10, convRate: '36%', avgDuration: '3m 22s' },
  ],
  month: [
    { name: 'Maria Santos', calls: 280, connected: 140, qualified: 58, convRate: '21%', avgDuration: '4m 10s' },
    { name: 'James Rivera', calls: 220, connected: 99, qualified: 38, convRate: '17%', avgDuration: '3m 52s' },
    { name: 'Luis Ortega', calls: 120, connected: 48, qualified: 20, convRate: '17%', avgDuration: '4m 55s' },
    { name: 'AI Voice Agent', calls: 115, connected: 115, qualified: 42, convRate: '37%', avgDuration: '3m 20s' },
  ],
};

const colors = ['hsl(160,75%,24%)', 'hsl(212,70%,37%)', 'hsl(36,80%,28%)', 'hsl(210,93%,17%)'];

export default function TeamPerformance() {
  const [period, setPeriod] = useState<Period>('today');
  const [drillAgent, setDrillAgent] = useState<typeof agentStats.today[0] | null>(null);
  const data = agentStats[period];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 items-center">
        {(['today', 'week', 'month'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">Click any agent for drill-down →</span>
      </div>

      <div className="metric-card">
        <h3 className="font-bold text-foreground mb-4">Calls by Agent</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" onClick={(e) => {
            if (e && e.activePayload && e.activePayload[0]) {
              const name = (e.activePayload[0].payload as { name: string }).name;
              const a = data.find(x => x.name === name);
              if (a) setDrillAgent(a);
            }
          }}>
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
            <Bar dataKey="calls" radius={[0, 6, 6, 0]} barSize={22} cursor="pointer">
              {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 text-muted-foreground font-medium">Agent</th>
              <th className="pb-3 text-muted-foreground font-medium text-right">Calls</th>
              <th className="pb-3 text-muted-foreground font-medium text-right">Connected</th>
              <th className="pb-3 text-muted-foreground font-medium text-right">Qualified</th>
              <th className="pb-3 text-muted-foreground font-medium text-right">Conv. Rate</th>
              <th className="pb-3 text-muted-foreground font-medium text-right">Avg Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.map((agent, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer" onClick={() => setDrillAgent(agent)}>
                <td className="py-3 font-medium text-foreground">{agent.name}</td>
                <td className="py-3 text-right text-foreground">{agent.calls}</td>
                <td className="py-3 text-right text-foreground">{agent.connected}</td>
                <td className="py-3 text-right text-foreground">{agent.qualified}</td>
                <td className="py-3 text-right text-foreground">{agent.convRate}</td>
                <td className="py-3 text-right text-muted-foreground">{agent.avgDuration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AgentDrillDown agent={drillAgent} open={!!drillAgent} onOpenChange={(o) => !o && setDrillAgent(null)} />
    </div>
  );
}
