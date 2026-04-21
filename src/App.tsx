import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import LoginPage from '@/pages/LoginPage';
import CEODashboard from '@/pages/CEODashboard';
import RepDashboard from '@/pages/RepDashboard';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';

function AppContent() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  if (user.role === 'ceo') return <CEODashboard />;
  return <RepDashboard />;
}

const App = () => (
  <AuthProvider>
    <AppProvider>
      <AppContent />
      <Toaster />
      <SonnerToaster position="bottom-right" theme="light" richColors closeButton />
    </AppProvider>
  </AuthProvider>
);

export default App;
