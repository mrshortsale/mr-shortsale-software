import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { getLeadsForAgent, getAICallScript, Lead } from '@/data/leads';
import { Phone, MessageSquare, Clock, XCircle, ChevronRight, MapPin, Calendar, Shield, AlertTriangle, Sparkles } from 'lucide-react';

export default function LeadQueue() {
  const { user } = useAuth();
  const { leads, updateLeadStatus, setActiveCallLeadId } = useApp();
  const [selectedLead, setSelectedLead] = useState<string | null>(null);

  const agentLeads = leads.filter(l => l.assigned_agent === user?.id).sort((a, b) => b.urgency_score - a.urgency_score);
  const selected = agentLeads.find(l => l.id === selectedLead);

  const handleCall = (leadId: string) => {
    updateLeadStatus(leadId, 'In Progress');
    setActiveCallLeadId(leadId);
  };

  const equityColor = (pct: number) => pct <= 14 ? 'equity-bar-red' : pct <= 20 ? 'equity-bar-amber' : 'equity-bar-green';
  const auctionColor = (days: number) => days < 30 ? 'text-destructive' : days < 60 ? 'text-warning' : 'text-accent';

  return (
    <div className="flex gap-4">
      {/* Lead list */}
      <div className={`flex-1 space-y-3 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-foreground">My Lead Queue</h2>
          <span className="text-sm text-muted-foreground">{agentLeads.length} leads</span>
        </div>
        {agentLeads.map((lead, i) => (
          <div
            key={lead.id}
            className={`metric-card cursor-pointer hover:shadow-md transition-shadow ${selectedLead === lead.id ? 'ring-2 ring-secondary' : ''}`}
            onClick={() => setSelectedLead(lead.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{lead.homeowner_name}</span>
                  <span className={lead.language_preference === 'ES' ? 'badge-es' : 'badge-en'}>{lead.language_preference}</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin size={10} />{lead.address}, {lead.city}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold ${auctionColor(lead.days_to_auction)}`}>
                  {lead.days_to_auction < 30 && <AlertTriangle size={10} className="inline mr-0.5" />}
                  {lead.days_to_auction} days
                </span>
                <p className="text-xs text-muted-foreground">to auction</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">{lead.filing_type}</span>
              <span className="text-xs text-muted-foreground">{lead.filing_date}</span>
              <span className="text-xs text-muted-foreground ml-auto">{lead.data_source_primary}{lead.attom_verified && ' · ATTOM ✓'}</span>
            </div>

            {/* Equity bar */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground w-16">Equity {lead.equity_pct}%</span>
              <div className="flex-1 bg-muted rounded-full h-2">
                <div className={`equity-bar ${equityColor(lead.equity_pct)}`} style={{ width: `${lead.equity_pct * 4}%` }} />
              </div>
            </div>

            {/* Status + actions */}
            <div className="flex items-center gap-2">
              <StatusBadge status={lead.call_status} />
              {lead.callback_scheduled_at && <span className="text-xs text-warning">CB: 3pm</span>}
              <div className="ml-auto flex gap-1.5">
                <button onClick={e => { e.stopPropagation(); handleCall(lead.id); }} className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:opacity-90 flex items-center gap-1"><Phone size={12} />Call Now</button>
                <button onClick={e => { e.stopPropagation(); updateLeadStatus(lead.id, 'SMS Sent'); }} className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90 flex items-center gap-1"><MessageSquare size={12} />SMS</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Research Panel */}
      {selected && (
        <div className="w-full lg:w-96 xl:w-[440px] shrink-0">
          <div className="sticky top-20">
            <div className="metric-card space-y-5 max-h-[calc(100vh-120px)] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-foreground">{selected.homeowner_name}</h3>
                  <p className="text-sm text-muted-foreground">{selected.address}, {selected.city} {selected.state}</p>
                </div>
                <button onClick={() => setSelectedLead(null)} className="lg:hidden text-muted-foreground"><XCircle size={20} /></button>
              </div>

              {/* Property summary */}
              <Section title="Property Summary">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Info label="Beds/Baths" value={`${selected.beds}bd / ${selected.baths}ba`} />
                  <Info label="Sqft" value={selected.sqft.toLocaleString()} />
                  <Info label="Year Built" value={String(selected.year_built)} />
                  <Info label="Est. Value" value={`$${selected.estimated_value.toLocaleString()}`} />
                  <Info label="Mortgage Balance" value={`$${selected.mortgage_balance.toLocaleString()}`} />
                  <Info label="Equity" value={`${selected.equity_pct}%`} />
                </div>
              </Section>

              {/* Data verification */}
              <Section title="Data Verification">
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground"><span className="font-medium text-foreground">Primary:</span> {selected.data_source_primary}</p>
                  <p className="text-muted-foreground"><span className="font-medium text-foreground">ATTOM:</span> {selected.attom_verified ? '✓ Equity confirmed' : 'Pending'}</p>
                  <p className="text-muted-foreground"><span className="font-medium text-foreground">Status:</span> <span className="text-accent">No discrepancies</span></p>
                </div>
              </Section>

              {/* Owner profile */}
              <Section title="Owner Profile">
                <div className="text-sm space-y-1">
                  <Info label="Owner" value={selected.homeowner_name} />
                  <Info label="Purchase Price" value={`$${selected.purchase_price.toLocaleString()}`} />
                  <Info label="Purchase Date" value={selected.purchase_date} />
                  <Info label="Lender" value={selected.mortgage_lender} />
                  <Info label="Phone" value={selected.phone} />
                  <Info label="Email" value={selected.email} />
                </div>
              </Section>

              {/* Urgency */}
              <Section title="Urgency Signals">
                <div className="text-sm space-y-1">
                  <Info label="Auction Date" value={selected.auction_date} />
                  <Info label="Days Left" value={`${selected.days_to_auction} days`} />
                  <Info label="Filing Type" value={selected.filing_type} />
                  <Info label="Urgency Score" value={`${selected.urgency_score}/10`} />
                </div>
              </Section>

              {/* Prior contact */}
              <Section title="Prior Contact History">
                <p className="text-sm text-muted-foreground">{selected.prior_contact ? 'Previously contacted — check call history' : 'No prior contact on record'}</p>
              </Section>

              {/* AI Script */}
              <Section title="AI Call Script">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg">{getAICallScript(selected)}</pre>
              </Section>

              <button onClick={() => handleCall(selected.id)} className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-semibold flex items-center justify-center gap-2">
                <Phone size={16} /> Call {selected.homeowner_name.split(' ')[0]} Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Connected' ? 'badge-qualified' : status === 'Not Called' ? 'bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full' : status === 'Callback Scheduled' ? 'badge-pending' : status === 'SMS Sent' ? 'badge-en' : status === 'VM Left' ? 'badge-pending' : 'badge-urgent';
  return <span className={cls}>{status}</span>;
}
