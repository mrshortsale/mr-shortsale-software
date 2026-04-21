import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ShortSaleCase } from '@/data/pipeline';
import { getCaseDetails } from '@/data/caseDetails';
import { Building2, User, Calendar, Phone, Mail, CheckCircle2, Circle, Clock, FileText } from 'lucide-react';

interface Props {
  caseData: ShortSaleCase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CaseDetailDrawer({ caseData, open, onOpenChange }: Props) {
  if (!caseData) return null;
  const d = getCaseDetails(caseData.id);
  const docsDone = d.documents.filter(x => x.done).length;
  const milestonesDone = d.milestones.filter(m => m.done).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="bg-primary text-primary-foreground p-6">
          <SheetHeader>
            <SheetTitle className="text-primary-foreground text-xl text-left">{caseData.homeowner}</SheetTitle>
            <p className="text-sm opacity-80 text-left">{caseData.address}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/20">{caseData.stage}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/30 inline-flex items-center gap-1">
                <Clock size={10} /> {d.days_in_stage} days in stage
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary/30">{caseData.equity_pct}% equity</span>
            </div>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-6">
          <Section title="Milestones" badge={`${milestonesDone}/${d.milestones.length}`}>
            <div className="space-y-2.5">
              {d.milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-3">
                  {m.done
                    ? <CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" />
                    : <Circle size={16} className="text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className={`text-sm ${m.done ? 'text-foreground' : 'text-muted-foreground'}`}>{m.label}</p>
                    {m.date && <p className="text-xs text-muted-foreground">{m.date}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Documents Checklist" badge={`${docsDone}/${d.documents.length}`}>
            <div className="grid grid-cols-2 gap-2">
              {d.documents.map((doc, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${doc.done ? 'bg-accent/5 border-accent/20' : 'bg-muted/30'}`}>
                  {doc.done
                    ? <CheckCircle2 size={14} className="text-accent shrink-0" />
                    : <Circle size={14} className="text-muted-foreground shrink-0" />}
                  <span className={doc.done ? 'text-foreground' : 'text-muted-foreground'}>{doc.label}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Bank & Negotiator">
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={14} className="text-secondary" />
                <span className="font-medium text-foreground">{caseData.bank}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-muted-foreground" />
                <span className="text-foreground">{d.bank_negotiator}</span>
              </div>
              {d.negotiator_phone !== '—' && (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={12} /> {d.negotiator_phone}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail size={12} /> {d.negotiator_email}
                  </div>
                </>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                <Calendar size={12} /> Last contact: {d.last_bank_contact}
              </div>
            </div>
          </Section>

          <Section title="Attorney & Agent">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Attorney</p>
                <p className="text-foreground font-medium mt-0.5">{caseData.attorney}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agent</p>
                <p className="text-foreground font-medium mt-0.5">{caseData.agent_name}</p>
              </div>
            </div>
          </Section>

          <Section title="Activity Log">
            <div className="space-y-3">
              {d.activity_log.map((a, i) => (
                <div key={i} className="border-l-2 border-secondary pl-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{a.author}</span>
                    <span className="text-muted-foreground">· {a.date}</span>
                  </div>
                  <p className="text-sm text-foreground mt-0.5">{a.text}</p>
                </div>
              ))}
            </div>
          </Section>

          {caseData.notes && (
            <Section title="Notes">
              <p className="text-sm text-muted-foreground">{caseData.notes}</p>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children, badge }: { title: string; children: React.ReactNode; badge?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</h4>
        {badge && <span className="text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      {children}
    </div>
  );
}
