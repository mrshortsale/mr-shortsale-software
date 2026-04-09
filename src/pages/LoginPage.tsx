import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(email, password)) {
      setError('Invalid credentials. Try cristina@mrshortsale.net / demo2026');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="bg-card rounded-2xl shadow-lg border p-8">
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Mr. Short Sale" className="h-20 mb-4" />
            <h1 className="text-2xl font-bold text-primary">AI Operations Platform</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="cristina@mrshortsale.net"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity">
              Sign In
            </button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground font-medium mb-2">Demo Credentials</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><strong>CEO:</strong> cristina@mrshortsale.net</p>
              <p><strong>Rep:</strong> maria@mrshortsale.net</p>
              <p><strong>Password:</strong> demo2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
