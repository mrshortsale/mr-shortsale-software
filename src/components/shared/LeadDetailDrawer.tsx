import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Lead, getAICallScript } from '@/data/leads';
import { getPriorContact, getUrgencyReason } from '@/data/activity';
import { getSMSThread } from '@/data/sms';
import { Phone, MessageSquare, Shield, Clock, AlertTriangle, Sparkles, CheckCircle2, Bot } from 'lucide-react';
import { useState } from 'react';
import SMSThread from './SMSThread';

interface Props {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCall?: (id: string) => void;
}

const urgencyColor = (s: number) =>
  s >= 9 ? 'bg-destructive text-destructive-foreground animate-pulse' :
  s >= 7 ? 'bg-warning text-primary-foreground' :
  s >= 4 ? 'bg-secondary/20 text-secondary' :
  'bg-muted text-muted-foreground';

export default function LeadDetailDrawer({ lead, open, onOpenChange, onCall }: Props) {
  const [smsOpen, setSmsOpen] = useState(false);

  if (!lead) return null;

  const prior = getPriorContact(lead.id);
  const reason = getUrgencyReason(lead.urgency_score, lead.days_to_auction, lead.equity_pct, prior.length);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-6">
            <SheetHeader>
              <div className="flex items-start gap-3">
                <div className={`shrink-0 px-3 py-2 rounded-lg font-bold text-lg ${urgencyColor(lead.urgency_score)}`}>
                  {lead.urgency_score}
                  <span className="text-xs opacity-80">/10</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <SheetTitle className="text-primary-foreground text-xl">{lead.homeowner_name}</SheetTitle>
                  <p className="text-sm opacity-80 mt-0.5">{lead.address}, {lead.city} {lead.state}</p>
                  <p className="text-xs opacity-70 mt-2 italic">{reason}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/20 text-accent-foreground">
                  <Sparkles size={10} /> AI Researched
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${lead.language_preference === 'ES' ? 'bg-warning/30' : 'bg-secondary/30'}`}>
                  {lead.language_preference === 'ES' ? 'Español' : 'English'}
                </span>
                {prior.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/30">
                    <Clock size={10} /> {prior.length} prior touch{prior.length > 1 ? 'es' : ''}
                  </span>
                )}
              </div>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* Property */}
            <Section title="Property Summary">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Beds/Baths" value={`${lead.beds}bd/${lead.baths}ba`} />
                <Stat label="Sqft" value={lead.sqft.toLocaleString()} />
                <Stat label="Built" value={String(lead.year_built)} />
                <Stat label="Est. Value" value={`$${(lead.estimated_value / 1000).toFixed(0)}K`} />
                <Stat label="Mortgage" value={`$${(lead.mortgage_balance / 1000).toFixed(0)}K`} />
                <Stat label="Equity" value={`${lead.equity_pct}%`} highlight={lead.equity_pct <= 15} />
              </div>
            </Section>

            {/* Verification */}
            <Section title="Data Verification">
              <div className="space-y-2">
                <VerifyRow source={lead.data_source_primary} verified ts="6:02 AM today" />
                <VerifyRow source={lead.data_source_primary === 'Realie' ? 'BatchLeads' : 'Realie'} verified ts="6:04 AM today" cross />
                <VerifyRow source="ATTOM" verified={lead.attom_verified} ts="6:08 AM today" cross note="Equity confirmed" />
              </div>
            </Section>

            {/* Owner */}
            <Section title="Owner Profile">
              <Info label="Owner since" value={`${lead.purchase_date} (${new Date().getFullYear() - new Date(lead.purchase_date).getFullYear()} yrs)`} />
              <Info label="Purchase Price" value={`$${lead.purchase_price.toLocaleString()}`} />
              <Info label="Lender" value={lead.mortgage_lender} />
              <Info label="Phone" value={lead.phone} />
              <Info label="Email" value={lead.email} />
            </Section>

            {/* Urgency */}
            <Section title="Urgency Signals">
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle size={14} className={lead.days_to_auction < 30 ? 'text-destructive' : 'text-warning'} />
                    Auction Date
                  </span>
                  <span className="text-sm font-bold text-foreground">{lead.auction_date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Countdown</span>
                  <span className={`text-lg font-bold font-mono ${lead.days_to_auction < 30 ? 'text-destructive' : lead.days_to_auction < 60 ? 'text-warning' : 'text-accent'}`}>
                    {lead.days_to_auction} days
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Filing Type</span>
                  <span className="text-sm font-medium text-foreground">{lead.filing_type} ({lead.filing_date})</span>
                </div>
                {lead.days_to_auction < 35 && (
                  <p className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-2">
                    ⚡ Time-critical — recommend immediate outreach
                  </p>
                )}
              </div>
            </Section>

            {/* Prior Contact */}
            <Section title="Prior Contact History">
              {prior.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">No prior contact on record</p>
                  <p className="text-xs text-accent font-medium mt-1">First touch — fresh opportunity</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {prior.map((t, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{t.channel}</span>
                          <span className="text-xs text-muted-foreground">{t.date} · {t.agent}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t.outcome}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Script */}
            <Section title={<><Bot size={14} className="inline mr-1 text-accent" />AI-Generated Call Script</>}>
              <pre className="text-xs text-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg max-h-60 overflow-y-auto leading-relaxed">{getAICallScript(lead)}</pre>
            </Section>

            {/* Actions */}
            <div className="sticky bottom-0 -mx-6 -mb-6 p-4 bg-card border-t flex gap-2">
              {lead.sms_sent && (
                <button onClick={() => setSmsOpen(true)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm">
                  <MessageSquare size={16} /> SMS Thread
                </button>
              )}
              {onCall && (
                <button onClick={() => { onCall(lead.id); onOpenChange(false); }} className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm">
                  <Phone size={16} /> Call Now
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <SMSThread open={smsOpen} onOpenChange={setSmsOpen} lead={lead} thread={getSMSThread(lead.id)} />
    </>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 ${highlight ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted'}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-destructive' : 'text-foreground'} mt-0.5`}>{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function VerifyRow({ source, verified, ts, cross, note }: { source: string; verified: boolean; ts: string; cross?: boolean; note?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 size={14} className={verified ? 'text-accent' : 'text-muted-foreground'} />
      <span className="font-medium text-foreground">{source}</span>
      {cross && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">cross-verified</span>}
      {note && <span className="text-xs text-accent">· {note}</span>}
      <span className="ml-auto text-xs text-muted-foreground">{ts}</span>
    </div>
  );
}
