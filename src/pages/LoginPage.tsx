import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';
import { User, Crown, Briefcase } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { email: 'cristina@mrshortsale.net', password: 'demo2026', name: 'Cristina Gaspar', role: 'CEO', icon: Crown, color: 'from-primary to-blue-700' },
  { email: 'maria@mrshortsale.net', password: 'demo2026', name: 'Maria Santos', role: 'Sales Rep', icon: Briefcase, color: 'from-teal-600 to-emerald-700' },
  { email: 'james@mrshortsale.net', password: 'demo2026', name: 'James Rivera', role: 'Sales Rep', icon: Briefcase, color: 'from-blue-500 to-indigo-600' },
  { email: 'luis@mrshortsale.net', password: 'demo2026', name: 'Luis Ortega', role: 'Sales Rep', icon: Briefcase, color: 'from-amber-600 to-orange-700' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleQuickLogin = (email: string, password: string) => {
    if (!login(email, password)) {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-primary/10 border border-white/60 p-10">
          {/* Header */}
          <div className="flex flex-col items-center mb-10">
            <div className="bg-primary/5 p-4 rounded-2xl mb-5">
              <img src={logo} alt="Mr. Short Sale" className="h-16" />
            </div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">AI Operations Platform</h1>
            <p className="text-muted-foreground text-sm mt-2">Select an account to explore the demo</p>
          </div>

          {/* Quick Login Cards */}
          <div className="space-y-3">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = account.icon;
              return (
                <button
                  key={account.email}
                  onClick={() => handleQuickLogin(account.email, account.password)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 group text-left"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${account.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{account.name}</p>
                    <p className="text-muted-foreground text-xs truncate">{account.email}</p>
                  </div>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                    {account.role}
                  </span>
                </button>
              );
            })}
          </div>

          {error && <p className="text-destructive text-sm text-center mt-4">{error}</p>}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            Prototype Demo · SJ Innovation · April 2026
          </p>
        </div>
      </div>
    </div>
  );
}
