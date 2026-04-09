import { useState } from 'react';
import { CheckCircle, Clock, Circle, ChevronDown, ChevronUp } from 'lucide-react';

interface Phase {
  phase: string;
  timeline: string;
  title: string;
  status: 'In Progress' | 'Planned';
  deliverables: string[];
  eliminates: string;
  timeSaved: string;
}

const phases: Phase[] = [
  {
    phase: 'Phase 1',
    timeline: 'Weeks 1-4',
    title: 'Connect & Consolidate',
    status: 'In Progress',
    deliverables: [
      'Realie.ai + BatchData API integration',
      'Equity filter pipeline (≤25%)',
      'Mojo Dialer API connection',
      'CEO dashboard v1',
      'Sales rep lead queue',
      'SMS auto-follow-up (Twilio)',
      'Parallel run with current vendor',
    ],
    eliminates: '3-day data lag, Excel delivery, app switching, manual call logging',
    timeSaved: 'Est. 8-12 hrs/week across team',
  },
  {
    phase: 'Phase 2',
    timeline: 'Weeks 5-8',
    title: 'AI Research Layer',
    status: 'Planned',
    deliverables: [
      'AI pre-researches every lead before call',
      'Cross-check Realie + BatchData + ATTOM',
      'Prior contact history check',
      'Personalized script generation per lead',
      'Lead urgency scoring 1-10',
      'ATTOM equity validation',
      'Duplicate detection',
    ],
    eliminates: 'Unresearched cold calls, duplicate outreach, manual script writing',
    timeSaved: 'Est. 15-20 hrs/week across team',
  },
  {
    phase: 'Phase 3',
    timeline: 'Weeks 9-12',
    title: 'AI Voice — Full Ops',
    status: 'Planned',
    deliverables: [
      'Inbound AI voice agent 24/7 (Vapi)',
      'English + Spanish with accent detection',
      'Outbound AI dialer for low-priority leads',
      'Full CEO ops dashboard',
      'Cristina owns complete AI stack',
      'No vendor dependency',
    ],
    eliminates: 'All after-hours missed calls, low-value outbound, CEO visibility gap',
    timeSaved: 'Est. 25+ hrs/week across team',
  },
];

export default function RoadmapView() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>('Phase 1');

  return (
    <div className="space-y-4">
      {phases.map(phase => {
        const isExpanded = expandedPhase === phase.phase;
        return (
          <div key={phase.phase} className="metric-card">
            <button className="w-full flex items-center justify-between" onClick={() => setExpandedPhase(isExpanded ? null : phase.phase)}>
              <div className="flex items-center gap-4">
                {phase.status === 'In Progress' ? (
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center"><Clock size={20} className="text-secondary" /></div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Circle size={20} className="text-muted-foreground" /></div>
                )}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{phase.phase}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phase.status === 'In Progress' ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'}`}>{phase.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{phase.title} · {phase.timeline}</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-2">Deliverables</h4>
                  <div className="space-y-2">
                    {phase.deliverables.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {phase.status === 'In Progress' && i < 3 ? (
                          <CheckCircle size={14} className="text-accent shrink-0" />
                        ) : (
                          <Circle size={14} className="text-muted-foreground shrink-0" />
                        )}
                        <span className="text-foreground">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Problems Eliminated</p>
                    <p className="text-sm text-foreground">{phase.eliminates}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Time Saved</p>
                    <p className="text-sm font-bold text-accent">{phase.timeSaved}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
