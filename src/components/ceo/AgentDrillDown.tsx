import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Clock, Target, Phone } from 'lucide-react';

interface AgentRow {
  name: string;
  calls: number;
  connected: number;
  qualified: number;
  convRate: string;
  avgDuration: string;
}

interface Props {
  agent: AgentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const trend7d = [
  { day: 'Wed', calls: 12 },
  { day: 'Thu', calls: 14 },
  { day: 'Fri', calls: 9 },
  { day: 'Sat', calls: 4 },
  { day: 'Sun', calls: 0 },
  { day: 'Mon', calls: 16 },
  { day: 'Tue', calls: 14 },
];

const timeOfDay = [
  { hr: '9am', rate: 22 },
  { hr: '10am', rate: 38 },
  { hr: '11am', rate: 41 },
  { hr: '12pm', rate: 28 },
  { hr: '1pm', rate: 18 },
  { hr: '2pm', rate: 32 },
  { hr: '3pm', rate: 45 },
  { hr: '4pm', rate: 52 },
  { hr: '5pm', rate: 36 },
];

const filingRates = [
  { type: 'NOD', rate: 28 },
  { type: 'Lis Pendens', rate: 35 },
  { type: 'NTS', rate: 48 },
];

const recentQualified = [
  'Patricia Lopez · 5 River Rd, Bronxville · 8% equity',
  'Carlos Mendez · 58 Oak Ave, Ossining · 9% equity',
  'Robert Chen · 88 Park Blvd, Tarrytown · 11% equity',
  'James Tran · 42 Oak St, White Plains · 18% equity',
  'Maria Santos · 17 Elm Ave, Yonkers · 22% equity',
];

export default function AgentDrillDown({ agent, open, onOpenChange }: Props) {
  if (!agent) return null;
  const isAI = agent.name.includes('AI');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground font-bold ${isAI ? 'bg-accent' : 'bg-secondary'}`}>
              {agent.name.charAt(0)}
            </div>
            <div>
              <p>{agent.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{isAI ? 'Vapi voice agent' : 'Sales rep'} · Performance details</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-3">
            <Stat icon={<Phone size={14} />} label="Calls" value={String(agent.calls)} />
            <Stat icon={<Target size={14} />} label="Connected" value={String(agent.connected)} />
            <Stat icon={<TrendingUp size={14} />} label="Qualified" value={String(agent.qualified)} accent />
            <Stat icon={<Clock size={14} />} label="Avg Duration" value={agent.avgDuration} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="metric-card">
              <h4 className="text-sm font-bold text-foreground mb-3">Last 7 Days — Call Volume</h4>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={trend7d}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="calls" stroke="hsl(var(--secondary))" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="metric-card">
              <h4 className="text-sm font-bold text-foreground mb-3">Best Time-of-Day to Connect</h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={timeOfDay}>
                  <XAxis dataKey="hr" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {timeOfDay.map((d, i) => (
                      <Cell key={i} fill={d.rate >= 40 ? 'hsl(var(--accent))' : 'hsl(var(--secondary))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-1">Peak: 4pm (52% connect rate)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="metric-card">
              <h4 className="text-sm font-bold text-foreground mb-3">Connection Rate by Filing Type</h4>
              <div className="space-y-2.5">
                {filingRates.map(f => (
                  <div key={f.type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{f.type}</span>
                      <span className="text-muted-foreground">{f.rate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: `${f.rate * 2}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="metric-card">
              <h4 className="text-sm font-bold text-foreground mb-3">Top 5 Recent Qualified Leads</h4>
              <ul className="space-y-1.5">
                {recentQualified.map((q, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2">
                    <span className="text-accent font-bold">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${accent ? 'bg-accent/10 border border-accent/30' : 'bg-muted/40 border'}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className={`text-lg font-bold mt-1 ${accent ? 'text-accent' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
