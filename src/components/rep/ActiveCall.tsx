import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getAICallScript } from '@/data/leads';
import { Phone, PhoneOff, MessageSquare, X } from 'lucide-react';

export default function ActiveCall() {
  const { leads, activeCallLeadId, setActiveCallLeadId, updateLeadStatus } = useApp();
  const { user } = useAuth();
  const lead = leads.find(l => l.id === activeCallLeadId);
  const [seconds, setSeconds] = useState(0);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const { t } = useTranslation();
  if (!lead) return null;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleOutcome = (result: string) => {
    clearInterval(intervalRef.current);
    setOutcome(result);
    updateLeadStatus(lead.id, result === 'Connected' ? 'Connected' : result === 'Voicemail Left' ? 'VM Left' : result === 'No Answer' ? 'SMS Sent' : 'Not Interested', result);
  };

  const handleClose = () => {
    setActiveCallLeadId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Call header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${outcome ? 'bg-muted/20' : 'bg-accent animate-pulse-slow'}`}>
              <Phone size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">{lead.homeowner_name}</h2>
              <p className="text-sm opacity-80">{lead.phone} · {lead.address}, {lead.city}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono font-bold">{formatTime(seconds)}</p>
            <p className="text-sm opacity-80">{outcome || 'Calling...'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 lg:p-6">
        {!outcome ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outcome buttons */}
            <div className="space-y-4">
              <h3 className="font-bold text-foreground">{t('activeCall.outcome')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <OutcomeButton label="Connected" onClick={() => handleOutcome('Connected')} color="bg-accent text-accent-foreground" />
                <OutcomeButton label="Voicemail Left" onClick={() => handleOutcome('Voicemail Left')} color="bg-warning text-primary-foreground" />
                <OutcomeButton label="No Answer" onClick={() => handleOutcome('No Answer')} color="bg-secondary text-secondary-foreground" />
                <OutcomeButton label="Not Interested" onClick={() => handleOutcome('Not Interested')} color="bg-destructive text-destructive-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Quick Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full mt-1 p-3 rounded-lg border bg-card text-foreground text-sm" rows={3} placeholder="Add call notes..." />
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <MessageSquare size={16} className="text-secondary" />
                <span className="text-sm text-foreground">Auto-SMS on no answer:</span>
                <span className="text-xs text-muted-foreground">"{lead.language_preference === 'ES' ? 'Hola, le llamamos de Mr. Short Sale...' : 'Hi, we called from Mr. Short Sale...'}"</span>
              </div>
            </div>

            {/* Script */}
            <div className="metric-card max-h-[60vh] overflow-y-auto">
              <h3 className="font-bold text-foreground mb-3">{t('activeCall.notes')}</h3>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{getAICallScript(lead)}</pre>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <PhoneOff size={28} className="text-accent" />
            </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t('activeCall.save')}</h3>
            <p className="text-muted-foreground mb-1">{lead.homeowner_name} · {formatTime(seconds)} · {outcome}</p>
            {notes && <p className="text-sm text-muted-foreground">{t('activeCall.notes')}: {notes}</p>}
            <button onClick={handleClose} className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold">
              {t('nav.queue')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OutcomeButton({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className={`${color} rounded-lg py-3 font-medium text-sm hover:opacity-90 transition-opacity`}>
      {label}
    </button>
  );
}
