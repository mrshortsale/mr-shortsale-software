import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

const sources = [
  { name: 'Realie.ai', status: 'Active', lastPull: 'Today 6:02 AM', records: '47 new', latency: '8ms', role: 'PRIMARY', desc: 'AI-sourced from 3,100+ counties' },
  { name: 'BatchLeads', status: 'Active', lastPull: 'Today 6:05 AM', records: '43 new (cross-check)', latency: '240ms', role: 'SPEED + CONTACTS', desc: 'Contact append + speed verification' },
  { name: 'ATTOM', status: 'Active', lastPull: 'Today 6:10 AM', records: '31 of 47 equity validated', latency: '1.2s', role: 'EQUITY VALIDATION', desc: 'AVM + equity % confirmation' },
  { name: 'Mojo Dialer API', status: 'Connected', lastPull: 'Last sync: 5 min ago', records: '—', latency: '—', role: 'DIALER', desc: 'One-click dial integration' },
  { name: 'Twilio SMS', status: 'Active', lastPull: '—', records: 'Sent: 9 · Delivered: 8 · Failed: 1', latency: '—', role: 'SMS', desc: 'Auto follow-up messaging' },
];

const comparison = [
  { source: 'Realie.ai', speed: 'Same day (<10ms)', counties: '3,100+ all 50 states', equity: 'Ownership + mortgage data', cost: '$50-200/mo', role: 'PRIMARY' },
  { source: 'BatchLeads', speed: '24-48 hours', counties: '3,200+ nationwide', equity: 'Contact + equity field', cost: '~$0.01/call', role: 'SPEED + CONTACTS' },
  { source: 'ATTOM', speed: 'Daily updates', counties: '158M properties', equity: 'AVM + equity %', cost: '~$0.10/call', role: 'EQUITY VALIDATION' },
  { source: 'PropStream', speed: 'Daily', counties: '160M properties', equity: 'AI Foreclosure Factor', cost: 'Subscription', role: 'FUTURE OPTION' },
  { source: 'Mojo Data Add-on', speed: '3 days lag', counties: 'County/state only', equity: 'None — manual', cost: '$49/mo', role: 'REPLACE' },
];

export default function DataSources() {
  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sources.map(s => (
          <div key={s.name} className="metric-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground">{s.name}</h3>
              <span className="flex items-center gap-1 text-xs font-medium">
                {s.status === 'Active' || s.status === 'Connected' ? <CheckCircle size={14} className="text-accent" /> : <AlertCircle size={14} className="text-destructive" />}
                <span className="text-accent">{s.status}</span>
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Last Pull</span><span className="text-foreground">{s.lastPull}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Records</span><span className="text-foreground">{s.records}</span></div>
              {s.latency !== '—' && <div className="flex justify-between"><span className="text-muted-foreground">Latency</span><span className="text-foreground">{s.latency}</span></div>}
            </div>
            <div className="mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="metric-card overflow-x-auto">
        <h3 className="font-bold text-foreground mb-4">Data Source Comparison</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 text-muted-foreground font-medium">Source</th>
              <th className="pb-3 text-muted-foreground font-medium">Speed</th>
              <th className="pb-3 text-muted-foreground font-medium">Coverage</th>
              <th className="pb-3 text-muted-foreground font-medium">Equity Filter</th>
              <th className="pb-3 text-muted-foreground font-medium">Cost</th>
              <th className="pb-3 text-muted-foreground font-medium">Our Role</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row, i) => (
              <tr key={i} className={`border-b last:border-0 ${row.role === 'REPLACE' ? 'opacity-50 line-through' : ''}`}>
                <td className="py-3 font-medium text-foreground">{row.source}</td>
                <td className="py-3 text-foreground">{row.speed}</td>
                <td className="py-3 text-muted-foreground">{row.counties}</td>
                <td className="py-3 text-muted-foreground">{row.equity}</td>
                <td className="py-3 text-foreground">{row.cost}</td>
                <td className="py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded ${row.role === 'PRIMARY' ? 'bg-accent/10 text-accent' : row.role === 'REPLACE' ? 'bg-destructive/10 text-destructive' : 'bg-secondary/10 text-secondary'}`}>{row.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
