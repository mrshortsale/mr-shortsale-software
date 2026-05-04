import { useState } from 'react';
import { realtorLeads, RealtorLead } from '@/data/realtorLeads';
import { Building2, Phone, Mail, ExternalLink, Calendar, TrendingDown } from 'lucide-react';
import RealtorLeadDetailDrawer from '@/components/shared/RealtorLeadDetailDrawer';

export default function RealtorQueue() {
  const [selected, setSelected] = useState<RealtorLead | null>(null);
  const queue = realtorLeads.filter(l => l.status === 'New' || l.status === 'Contacted');

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-secondary/10 border border-secondary/20 p-3 flex items-start gap-2">
        <Building2 className="text-secondary mt-0.5" size={16} />
        <div className="text-xs text-foreground">
          <strong>Realtor Short Sale queue.</strong> These are listing agents — pitch realtor-to-realtor. They keep their commission, we close the file.
        </div>
      </div>

      {queue.map(lead => (
        <button
          key={lead.id}
          onClick={() => setSelected(lead)}
          className="w-full text-left bg-card border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-foreground">{lead.agentName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{lead.status}</span>
            {lead.language === 'ES' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-bold">ES</span>}
          </div>
          <p className="text-xs text-muted-foreground">{lead.brokerage}</p>
          <p className="text-xs text-foreground mt-1">{lead.propertyAddress}, {lead.city}, {lead.state}</p>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span>${(lead.listPrice / 1000).toFixed(0)}k</span>
            <span className="flex items-center gap-1"><Calendar size={10} /> {lead.daysOnMarket}d</span>
            {lead.priceDrops.length > 0 && <span className="flex items-center gap-1 text-speed"><TrendingDown size={10} /> {lead.priceDrops.length} drops</span>}
          </div>
        </button>
      ))}

      {selected && <RealtorLeadDetailDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
