import { RealtorLead } from '@/data/realtorLeads';
import { X, Phone, Mail, ExternalLink, MapPin, Calendar, TrendingDown, Building2, MessageSquare, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function RealtorLeadDetailDrawer({ lead, onClose }: { lead: RealtorLead; onClose: () => void }) {
  const { i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/40" onClick={onClose} />
      <aside className="w-full max-w-[520px] bg-card overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-xs opacity-80">
              <Building2 size={14} /> Realtor Lead · {lead.source}
            </div>
            <button onClick={onClose} className="opacity-80 hover:opacity-100"><X size={18} /></button>
          </div>
          <h2 className="text-xl font-bold">{lead.agentName}</h2>
          <p className="text-sm opacity-90 mt-0.5">{lead.brokerage}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[10px] px-2 py-0.5 rounded bg-card/20 font-bold">{lead.status}</span>
            {lead.language === 'ES' && <span className="text-[10px] px-2 py-0.5 rounded bg-secondary/30 font-bold flex items-center gap-1"><Globe size={10} /> Spanish preferred</span>}
            <span className="text-[10px] px-2 py-0.5 rounded bg-card/20">MLS# {lead.mlsNumber}</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2 p-4 border-b">
          <a href={`tel:${lead.agentPhone}`} className="flex flex-col items-center gap-1 py-3 rounded-lg bg-accent text-accent-foreground hover:opacity-90">
            <Phone size={16} />
            <span className="text-xs font-bold">Call</span>
          </a>
          <a href={`mailto:${lead.agentEmail}`} className="flex flex-col items-center gap-1 py-3 rounded-lg bg-secondary text-secondary-foreground hover:opacity-90">
            <Mail size={16} />
            <span className="text-xs font-bold">Email</span>
          </a>
          <a href={lead.listingUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 py-3 rounded-lg bg-muted text-foreground hover:bg-muted/70">
            <ExternalLink size={16} />
            <span className="text-xs font-bold">Listing</span>
          </a>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          <Section title="Contact">
            <Row icon={<Phone size={12} />} label="Phone" value={lead.agentPhone} />
            <Row icon={<Mail size={12} />} label="Email" value={lead.agentEmail} />
          </Section>

          <Section title="Property">
            <Row icon={<MapPin size={12} />} label="Address" value={`${lead.propertyAddress}, ${lead.city}, ${lead.state}`} />
            <Row label="List price" value={`$${lead.listPrice.toLocaleString(loc)}`} />
            <Row icon={<Calendar size={12} />} label="Days on market" value={`${lead.daysOnMarket} days`} />
          </Section>

          {lead.priceDrops.length > 0 && (
            <Section title="Price drop history">
              {lead.priceDrops.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><TrendingDown size={12} className="text-speed" /> {d.date}</span>
                  <span className="font-bold text-speed">−${d.amount.toLocaleString(loc)}</span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground italic mt-1">Multiple price drops = motivated seller, agent open to outside help.</p>
            </Section>
          )}

          <Section title="Activity">
            <Row label="Last contact" value={lead.lastContactAt || 'Not yet contacted'} />
            {lead.notes && <p className="text-sm text-foreground bg-muted/50 rounded p-2 mt-2">{lead.notes}</p>}
          </Section>

          <div className="rounded-lg border-l-4 border-l-secondary bg-secondary/5 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-secondary mb-1">
              <MessageSquare size={12} /> Suggested opener
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              "Hi {lead.agentName.split(' ')[0]}, I noticed your short sale listing at {lead.propertyAddress}. We process short sales at no cost to the listing agent — you keep your full commission. Got 90 seconds?"
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm gap-3">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="text-foreground font-medium text-right truncate">{value}</span>
    </div>
  );
}
