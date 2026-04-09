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
              <>
                <tr key={call.id} className="border-b cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}>
                  <td className="py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <Bot size={14} className="text-secondary" />
                      {call.caller}
                    </div>
                  </td>
                  <td className="py-3 text-muted-foreground">{call.date_time}</td>
                  <td className="py-3"><span className={call.language === 'ES' ? 'badge-es' : 'badge-en'}>{call.language}</span></td>
                  <td className="py-3 text-foreground">{call.duration}</td>
                  <td className="py-3">
                    <span className={call.outcome.includes('Qualified') ? 'badge-qualified' : call.outcome.includes('Not') || call.outcome.includes('Hung') ? 'badge-urgent' : 'badge-pending'}>
                      {call.outcome}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">{call.property}</td>
                  <td className="py-3">{expandedId === call.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                </tr>
                {expandedId === call.id && (
                  <tr key={`${call.id}-detail`}>
                    <td colSpan={7} className="p-4 bg-muted/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-foreground mb-2">AI Summary</h4>
                          <p className="text-sm text-muted-foreground">{call.ai_summary}</p>
                          <div className="flex gap-2 mt-3">
                            {call.lead_created && <span className="badge-qualified">Lead Created</span>}
                            <span className={call.language === 'ES' ? 'badge-es' : 'badge-en'}>{call.language === 'ES' ? 'Spanish' : 'English'}</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground mb-2">Transcript</h4>
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-card p-3 rounded-lg border max-h-60 overflow-y-auto">{call.transcript}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
