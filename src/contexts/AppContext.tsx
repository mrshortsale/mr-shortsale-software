import React, { createContext, useContext, useState, useCallback } from 'react';
import { allLeads, Lead, CallStatus } from '@/data/leads';

interface AppState {
  leads: Lead[];
  updateLeadStatus: (leadId: string, status: CallStatus, outcome?: string) => void;
  activeCallLeadId: string | null;
  setActiveCallLeadId: (id: string | null) => void;
}

const AppContext = createContext<AppState>({
  leads: allLeads,
  updateLeadStatus: () => {},
  activeCallLeadId: null,
  setActiveCallLeadId: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(allLeads);
  const [activeCallLeadId, setActiveCallLeadId] = useState<string | null>(null);

  const updateLeadStatus = useCallback((leadId: string, status: CallStatus, outcome?: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, call_status: status, last_call_outcome: outcome || l.last_call_outcome, last_call_date: '2026-04-09' } : l));
  }, []);

  return (
    <AppContext.Provider value={{ leads, updateLeadStatus, activeCallLeadId, setActiveCallLeadId }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
