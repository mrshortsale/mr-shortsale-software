import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Lead } from '@/data/leads';
import { getPriorContact } from '@/data/activity';
import { getAttomIntelForLead } from '@/integrations/attom';
import { Phone, MessageSquare, MapPin, AlertTriangle, Sparkles, Clock, Filter, ArrowUpDown, Target, TrendingUp } from 'lucide-react';
import LeadDetailDrawer from '@/components/shared/LeadDetailDrawer';

type SortKey = 'urgency' | 'auction' | 'equity' | 'name';
type FilterLang = 'all' | 'EN' | 'ES';
type FilterStatus = 'all' | 'Not Called' | 'Called' | 'Connected' | 'Callback Scheduled' | 'SMS Sent' | 'VM Left';

export default function LeadQueue() {
  const { user } = useAuth();
  const { leads, updateLeadStatus, setActiveCallLeadId } = useApp();
  const { t } = useTranslation();
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('urgency');
  const [filterLang, setFilterLang] = useState<FilterLang>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const agentLeads = useMemo(() => {
    let list = leads.filter(l => l.assigned_agent === user?.id);
    if (filterLang !== 'all') list = list.filter(l => l.language_preference === filterLang);
    if (filterStatus !== 'all') list = list.filter(l => l.call_status === filterStatus);
    list = [...list].sort((a, b) => {
      if (sortKey === 'urgency') return b.urgency_score - a.urgency_score;
      if (sortKey === 'auction') return a.days_to_auction - b.days_to_auction;
      if (sortKey === 'equity') return a.equity_pct - b.equity_pct;
      return a.homeowner_name.localeCompare(b.homeowner_name);
    });
    return list;
  }, [leads, user, sortKey, filterLang, filterStatus]);

  const handleCall = (leadId: string) => {
    updateLeadStatus(leadId, 'In Progress');
    setActiveCallLeadId(leadId);
  };

  // "Today" stats banner
  const todayStats = useMemo(() => {
    const mine = leads.filter(l => l.assigned_agent === user?.id);
    const calls = mine.filter(l => l.last_call_date === '2026-04-09' || l.call_status !== 'Not Called').length;
    const connected = mine.filter(l => l.call_status === 'Connected' || l.last_call_outcome?.includes('Connected')).length;
    const qualified = mine.filter(l => l.last_call_outcome?.includes('qualified')).length;
    return { calls, connected, qualified, goal: 12 };
  }, [leads, user]);

  const drawerLead = drawerLeadId ? leads.find(l => l.id === drawerLeadId) || null : null;

  return (
    <div className="space-y-4">
      {/* Today banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary to-secondary p-4 text-primary-foreground flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Target size={18} />
          <span className="font-bold text-sm">{t('leadQueue.today')}</span>
        </div>
        <BannerStat label={t('leadQueue.banner.calls')} value={todayStats.calls} goal={todayStats.goal} />
        <BannerStat label={t('leadQueue.banner.connected')} value={todayStats.connected} />
        <BannerStat label={t('leadQueue.banner.qualified')} value={todayStats.qualified} />
        <span className="ml-auto text-xs opacity-80 hidden sm:block">
          AI pre-researched all {agentLeads.length} of your leads · Scripts ready
        </span>
      </div>

      <div className="rounded-lg bg-muted/60 border px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
        <Filter size={12} className="text-primary" />
        <span>You're seeing <strong className="text-foreground">{agentLeads.length}</strong> of <strong className="text-foreground">34,812</strong> Batch leads — auto-assigned by AI score + territory.</span>
      </div>

      {/* Filters/Sort */}
      <div className="flex flex-wrap items-center gap-2 metric-card py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowUpDown size={12} /> {t('leadQueue.sort.label')}
        </div>
        {(['urgency', 'auction', 'equity', 'name'] as SortKey[]).map(k => (
          <button key={k} onClick={() => setSortKey(k)} className={`text-xs px-2.5 py-1 rounded-full ${sortKey === k ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {k === 'urgency' ? t('leadQueue.sort.urgency') : k === 'auction' ? t('leadQueue.sort.auction') : k === 'equity' ? t('leadQueue.sort.equity') : t('leadQueue.sort.name')}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-2" />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter size={12} /> {t('leadQueue.filter.lang')}
        </div>
        {(['all', 'EN', 'ES'] as FilterLang[]).map(l => (
          <button key={l} onClick={() => setFilterLang(l)} className={`text-xs px-2.5 py-1 rounded-full ${filterLang === l ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {l === 'all' ? t('leadQueue.filter.all') : l}
          </button>
        ))}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as FilterStatus)}
          className="text-xs px-2 py-1 rounded-md border bg-card text-foreground ml-auto"
        >
          <option value="all">{t('leadQueue.filter.allStatuses')}</option>
          <option value="Not Called">{t('leadQueue.filter.notCalled')}</option>
          <option value="Connected">{t('leadQueue.filter.connected')}</option>
          <option value="Callback Scheduled">{t('leadQueue.filter.callbackScheduled')}</option>
          <option value="SMS Sent">{t('leadQueue.filter.smsSent')}</option>
          <option value="VM Left">{t('leadQueue.filter.vmLeft')}</option>
        </select>
        <span className="text-xs text-muted-foreground">{agentLeads.length} leads</span>
      </div>

      {/* Leads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {agentLeads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onSelect={() => setDrawerLeadId(lead.id)}
            onCall={() => handleCall(lead.id)}
            onSMS={() => updateLeadStatus(lead.id, 'SMS Sent')}
          />
        ))}
      </div>

      <LeadDetailDrawer
        lead={drawerLead}
        open={!!drawerLeadId}
        onOpenChange={(o) => !o && setDrawerLeadId(null)}
        onCall={handleCall}
      />
    </div>
  );
}

function BannerStat({ label, value, goal }: { label: string; value: number; goal?: number }) {
  return (
    <div className="text-sm">
      <span className="opacity-80">{label}: </span>
      <span className="font-bold">{value}</span>
      {goal !== undefined && <span className="opacity-70"> / {goal}</span>}
    </div>
  );
}

const urgencyBadge = (s: number) =>
  s >= 9 ? 'bg-destructive text-destructive-foreground animate-pulse' :
  s >= 7 ? 'bg-warning text-primary-foreground' :
  s >= 4 ? 'bg-secondary/20 text-secondary' :
  'bg-muted text-muted-foreground';

const equityColor = (pct: number) => pct <= 14 ? 'bg-destructive' : pct <= 20 ? 'bg-warning' : 'bg-accent';
const auctionColor = (days: number) => days < 30 ? 'text-destructive' : days < 60 ? 'text-warning' : 'text-accent';

function LeadCard({ lead, onSelect, onCall, onSMS }: { lead: Lead; onSelect: () => void; onCall: () => void; onSMS: () => void }) {
  const prior = getPriorContact(lead.id);
  const attom = getAttomIntelForLead(lead.id, { value: lead.estimated_value, equity: lead.equity_pct, owner: lead.homeowner_name, purchaseDate: lead.purchase_date });
  const sourceLabel = lead.data_source_primary === 'BatchLeads' ? 'Batch Leads API' : 'Realie.ai';
  const { t } = useTranslation();

  return (
    <div onClick={onSelect} className="metric-card cursor-pointer hover:shadow-md hover:border-secondary/40 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className={`shrink-0 px-2 py-1.5 rounded-lg font-bold text-sm min-w-[44px] text-center ${urgencyBadge(lead.urgency_score)}`}>
          {lead.urgency_score}
          <div className="text-[9px] opacity-80 leading-none">/10</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{lead.homeowner_name}</span>
            <span className={lead.language_preference === 'ES' ? 'badge-es' : 'badge-en'}>{lead.language_preference}</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin size={10} />{lead.address}, {lead.city}</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-xs font-bold ${auctionColor(lead.days_to_auction)}`}>
            {lead.days_to_auction < 30 && <AlertTriangle size={10} className="inline mr-0.5" />}
            {lead.days_to_auction}d
          </span>
          <p className="text-[10px] text-muted-foreground">{t('leadQueue.card.toAuction')}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">{lead.filing_type}</span>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent">
            <Sparkles size={9} /> {t('leadQueue.card.aiResearched')}
          </span>
          {prior.length > 0 && (
            <span title={`${prior.length} prior touch${prior.length > 1 ? 'es' : ''} — last: ${prior[prior.length - 1].outcome}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/15 text-warning cursor-help">
              <Clock size={9} /> {t('leadQueue.card.priorContact')}
            </span>
          )}
          {attom.highEquity && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent text-accent-foreground">
              <TrendingUp size={9} /> {t('leadQueue.card.highEquity')}
            </span>
          )}
          {attom.taxDelinquent && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive text-destructive-foreground">
              {t('leadQueue.card.taxDelinquent')}
            </span>
          )}
        <span className="text-[10px] text-muted-foreground ml-auto">{sourceLabel}</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-muted-foreground w-16">{t('leadQueue.card.equity')} {lead.equity_pct}%</span>
        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full ${equityColor(lead.equity_pct)}`} style={{ width: `${Math.min(100, lead.equity_pct * 4)}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StatusBadge status={lead.call_status} />
        {lead.callback_scheduled_at && <span className="text-[10px] text-warning font-medium">{t('leadQueue.card.cbScheduled')}</span>}
        <div className="ml-auto flex gap-1.5">
          <button onClick={e => { e.stopPropagation(); onCall(); }} className="px-2.5 py-1 bg-accent text-accent-foreground rounded-md text-[11px] font-medium hover:opacity-90 flex items-center gap-1">
            <Phone size={11} />{t('leadQueue.card.call')}
          </button>
          <button onClick={e => { e.stopPropagation(); onSMS(); }} className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md text-[11px] font-medium hover:opacity-90 flex items-center gap-1">
            <MessageSquare size={11} />{t('leadQueue.card.sms')}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Connected' ? 'badge-qualified'
    : status === 'Not Called' ? 'bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full'
    : status === 'Callback Scheduled' ? 'badge-pending'
    : status === 'SMS Sent' ? 'badge-en'
    : status === 'VM Left' ? 'badge-pending'
    : 'badge-urgent';
  return <span className={cls}>{status}</span>;
}
