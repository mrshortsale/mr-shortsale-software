import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { mariaCallHistory, jamesCallHistory, luisCallHistory } from '@/data/calls';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function RepStats() {
  const { user } = useAuth();
  const { leads } = useApp();
  const history = user?.id === 'u2' ? mariaCallHistory : user?.id === 'u3' ? jamesCallHistory : luisCallHistory;
  const myLeads = leads.filter(l => l.assigned_agent === user?.id);

  const connected = history.filter(c => c.outcome.includes('Connected')).length;
  const qualified = history.filter(c => c.outcome.includes('qualified')).length;

  const weekData = [
    { day: 'Mon', calls: 6 },
    { day: 'Tue', calls: 8 },
    { day: 'Wed', calls: 5 },
    { day: 'Thu', calls: 7 },
    { day: 'Fri', calls: 4 },
    { day: 'Sat', calls: 0 },
    { day: 'Sun', calls: 0 },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">My Stats</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Calls" value={String(history.length)} />
        <StatCard label="Connected" value={String(connected)} />
        <StatCard label="Qualified" value={String(qualified)} />
        <StatCard label="Leads in Queue" value={String(myLeads.length)} />
      </div>

      <div className="metric-card">
        <h3 className="font-bold text-foreground mb-4">Calls This Week</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weekData}>
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Bar dataKey="calls" fill="hsl(212,70%,37%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card text-center">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
