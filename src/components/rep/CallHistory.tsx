import { useAuth } from '@/contexts/AuthContext';
import { mariaCallHistory, jamesCallHistory, luisCallHistory, CallRecord } from '@/data/calls';
import { MessageSquare } from 'lucide-react';

export default function CallHistory() {
  const { user } = useAuth();
  const history = user?.id === 'u2' ? mariaCallHistory : user?.id === 'u3' ? jamesCallHistory : luisCallHistory;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Call History</h2>
      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 text-muted-foreground font-medium">Date</th>
              <th className="pb-3 text-muted-foreground font-medium">Homeowner</th>
              <th className="pb-3 text-muted-foreground font-medium">Duration</th>
              <th className="pb-3 text-muted-foreground font-medium">Outcome</th>
              <th className="pb-3 text-muted-foreground font-medium">Follow-up</th>
              <th className="pb-3 text-muted-foreground font-medium">SMS</th>
            </tr>
          </thead>
          <tbody>
            {history.map(call => (
              <tr key={call.id} className="border-b last:border-0">
                <td className="py-3 text-muted-foreground">{call.date}</td>
                <td className="py-3 font-medium text-foreground">{call.lead_name}</td>
                <td className="py-3 text-foreground">{call.duration}</td>
                <td className="py-3">
                  <span className={call.outcome.includes('Connected') ? 'badge-qualified' : call.outcome.includes('No Answer') || call.outcome === 'Hung up' ? 'badge-urgent' : 'badge-pending'}>
                    {call.outcome}
                  </span>
                </td>
                <td className="py-3 text-muted-foreground">{call.follow_up}</td>
                <td className="py-3">{call.sms_sent && <MessageSquare size={14} className="text-secondary" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
