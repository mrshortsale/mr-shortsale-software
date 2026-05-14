import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import LoginPage from '@/pages/LoginPage';
import CEODashboard from '@/pages/CEODashboard';
import RepDashboard from '@/pages/RepDashboard';
import Proposal from '@/pages/Proposal';
import Costs from '@/pages/Costs';
import NotFound from '@/pages/NotFound';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={36} className="animate-spin text-primary/40" />
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (user.role === 'ceo') return <CEODashboard />;
  return <RepDashboard />;
}

const App = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <Routes>
            <Route path="/proposal" element={<Proposal />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/" element={<AppShell />} />
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
