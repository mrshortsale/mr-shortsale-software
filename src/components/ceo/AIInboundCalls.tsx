import { useState } from 'react';
import { aiInboundCalls } from '@/data/calls';
import { Bot, ChevronDown, ChevronUp } from 'lucide-react';

export default function AIInboundCalls() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 text-muted-foreground font-medium">Caller</th>
              <th className="pb-3 text-muted-foreground font-medium">Date/Time</th>
              <th className="pb-3 text-muted-foreground font-medium">Language</th>
              <th className="pb-3 text-muted-foreground font-medium">Duration</th>
              <th className="pb-3 text-muted-foreground font-medium">Outcome</th>
              <th className="pb-3 text-muted-foreground font-medium">Property</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {aiInboundCalls.map(call => (
              <FragmentRow key={call.id} call={call} expanded={expandedId === call.id} onToggle={() => setExpandedId(expandedId === call.id ? null : call.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
