import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import LoginPage from '@/pages/LoginPage';
import CEODashboard from '@/pages/CEODashboard';
import RepDashboard from '@/pages/RepDashboard';
import Proposal from '@/pages/Proposal';
import Costs from '@/pages/Costs';
import NotFound from '@/pages/NotFound';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';

function AppShell() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  if (user.role === 'ceo') return <CEODashboard />;
  return <RepDashboard />;
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppProvider>
        <Routes>
          <Route path="/proposal" element={<Proposal />} />
          <Route path="/costs" element={<Costs />} />
          <Route path="/" element={<AppShell />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
        <SonnerToaster position="bottom-right" theme="light" richColors closeButton />
      </AppProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
