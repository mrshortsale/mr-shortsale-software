import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import LoginPage from '@/pages/LoginPage';
import Proposal from '@/pages/Proposal';
import Costs from '@/pages/Costs';
import NotFound from '@/pages/NotFound';
import CEOLayout from '@/layouts/CEOLayout';
import RepLayout from '@/layouts/RepLayout';
import { CEO_BASE } from '@/config/ceoNav';
import { REP_BASE } from '@/config/repNav';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';

import MorningBriefing from '@/components/ceo/MorningBriefing';
import LeadInventory from '@/components/ceo/LeadInventory';
import RealtorLeadQueue from '@/components/ceo/RealtorLeadQueue';
import RealtorPipeline from '@/components/ceo/RealtorPipeline';
import RealtorScripts from '@/components/ceo/RealtorScripts';
import RealtorReports from '@/components/ceo/RealtorReports';
import PipelineBoard from '@/components/ceo/PipelineBoard';
import SpeedToLeadScreen from '@/components/ceo/SpeedToLeadScreen';
import MojoDialerScreen from '@/components/ceo/MojoDialerScreen';
import TeamPerformance from '@/components/ceo/TeamPerformance';
import CEORoadmapPage from '@/pages/ceo/CEORoadmapPage';
import Presentation from '@/components/ceo/Presentation';
import UserManagement from '@/components/ceo/UserManagement';
import IntegrationsPage from '@/components/integrations/IntegrationsPage';
import DataSources from '@/components/ceo/DataSources';
import CEOSettingsPage from '@/pages/ceo/CEOSettingsPage';
import SyncRunsPage from '@/pages/ceo/SyncRunsPage';
import AIInboundCalls from '@/components/ceo/AIInboundCalls';
import AIAgentsRoster from '@/components/ceo/AIAgentsRoster';
import AgentsPage from '@/pages/ceo/ai/AgentsPage';
import LogsPage from '@/pages/ceo/ai/LogsPage';

import GoogleCallbackPage from '@/pages/GoogleCallbackPage';
import RepQueuePage from '@/pages/rep/RepQueuePage';
import RealtorQueue from '@/components/rep/RealtorQueue';
import CallHistory from '@/components/rep/CallHistory';
import RepStats from '@/components/rep/RepStats';

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={36} className="animate-spin text-primary/40" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (user.role === 'ceo') {
    return <Navigate to={`${CEO_BASE}/briefing`} replace />;
  }

  return <Navigate to={`${REP_BASE}/queue`} replace />;
}

const App = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path={CEO_BASE} element={<CEOLayout />}>
              <Route index element={<Navigate to="briefing" replace />} />
              <Route path="briefing" element={<MorningBriefing />} />
              <Route path="inventory" element={<LeadInventory />} />
              <Route path="sync-runs" element={<SyncRunsPage />} />
              <Route path="realtor-queue" element={<RealtorLeadQueue />} />
              <Route path="realtor-pipeline" element={<RealtorPipeline />} />
              <Route path="realtor-scripts" element={<RealtorScripts />} />
              <Route path="realtor-reports" element={<RealtorReports />} />
              <Route path="pipeline" element={<PipelineBoard />} />
              <Route path="speed" element={<SpeedToLeadScreen />} />
              <Route path="dialer" element={<MojoDialerScreen />} />
              <Route path="team" element={<TeamPerformance />} />
              <Route path="roadmap" element={<CEORoadmapPage />} />
              <Route path="presentation" element={<Presentation />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="data" element={<DataSources />} />
              <Route path="settings" element={<CEOSettingsPage />} />
              <Route path="ai/agents" element={<AgentsPage />} />
              <Route path="ai/logs" element={<LogsPage />} />
              <Route path="preview/ai-calls" element={<AIInboundCalls />} />
              <Route path="preview/ai-agents" element={<AIAgentsRoster />} />
            </Route>

            <Route path={REP_BASE} element={<RepLayout />}>
              <Route index element={<Navigate to="queue" replace />} />
              <Route path="queue" element={<RepQueuePage />} />
              <Route path="realtor" element={<RealtorQueue />} />
              <Route path="history" element={<CallHistory />} />
              <Route path="stats" element={<RepStats />} />
            </Route>

            <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
            <Route path="/proposal" element={<Proposal />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <SonnerToaster position="bottom-right" richColors closeButton />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;
