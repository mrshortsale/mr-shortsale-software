import { useMemo, useState } from 'react';
import { realtorLeads, RealtorLead, RealtorLeadStatus } from '@/data/realtorLeads';
import { Phone, Mail, ExternalLink, Filter, ArrowUpDown, Calendar, MapPin, TrendingDown } from 'lucide-react';
import RealtorLeadDetailDrawer from '@/components/shared/RealtorLeadDetailDrawer';

type SortKey = 'days' | 'price' | 'drops';

const statusBadge: Record<RealtorLeadStatus, string> = {
  'New':         'bg-secondary/10 text-secondary',
  'Contacted':   'bg-speed/15 text-speed',
  'Partnered':   'bg-accent/15 text-accent',
  'Closed Won':  'bg-accent text-accent-foreground',
  'Declined':    'bg-muted text-muted-foreground',
};

export default function RealtorLeadQueue() {
  const [selected, setSelected] = useState<RealtorLead | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [filterState, setFilterState] = useState<'all' | 'FL' | 'NY' | 'CA'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | RealtorLeadStatus>('all');

  const list = useMemo(() => {
    let l = [...realtorLeads];
    if (filterState !== 'all') l = l.filter(x => x.state === filterState);
    if (filterStatus !== 'all') l = l.filter(x => x.status === filterStatus);
    l.sort((a, b) => {
      if (sortKey === 'days') return b.daysOnMarket - a.daysOnMarket;
      if (sortKey === 'price') return b.listPrice - a.listPrice;
      return b.priceDrops.length - a.priceDrops.length;
    });
    return l;
  }, [sortKey, filterState, filterStatus]);

  return (
    <div className="space-y-4">
      <div className="metric-card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Filter size={14} className="text-muted-foreground" />
          <select value={filterState} onChange={e => setFilterState(e.target.value as 'all' | 'FL' | 'NY' | 'CA')} className="bg-muted rounded px-2 py-1 border-0 outline-none">
            <option value="all">All states</option>
            <option value="FL">Florida</option>
            <option value="NY">New York</option>
            <option value="CA">California</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'all' | RealtorLeadStatus)} className="bg-muted rounded px-2 py-1 border-0 outline-none">
            <option value="all">All statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Partnered">Partnered</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Declined">Declined</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs ml-auto">
          <ArrowUpDown size={14} className="text-muted-foreground" />
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="bg-muted rounded px-2 py-1 border-0 outline-none">
            <option value="days">Days on market (desc)</option>
            <option value="price">List price (desc)</option>
            <option value="drops">Most price drops</option>
          </select>
        </div>
        <span className="text-xs text-muted-foreground">{list.length} leads</span>
      </div>

      <div className="space-y-2">
        {list.map(lead => (
          <button
            key={lead.id}
            onClick={() => setSelected(lead)}
            className="w-full text-left metric-card hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground">{lead.agentName}</span>
                <span className="text-xs text-muted-foreground">· {lead.brokerage}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${statusBadge[lead.status]}`}>{lead.status}</span>
                {lead.language === 'ES' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/10 text-secondary font-bold">ES</span>}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin size={11} /> {lead.propertyAddress}, {lead.city}, {lead.state}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <p className="text-muted-foreground">List price</p>
                <p className="font-bold text-foreground">${lead.listPrice.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground flex items-center gap-1 justify-end"><Calendar size={10} /> DOM</p>
                <p className="font-bold text-foreground">{lead.daysOnMarket}d</p>
              </div>
              {lead.priceDrops.length > 0 && (
                <div className="text-right">
                  <p className="text-muted-foreground flex items-center gap-1 justify-end"><TrendingDown size={10} /> Drops</p>
                  <p className="font-bold text-speed">{lead.priceDrops.length}</p>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && <RealtorLeadDetailDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
