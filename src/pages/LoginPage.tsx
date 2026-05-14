import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Crown, Briefcase, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

// ─── Demo quick-login accounts ────────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  { email: 'cristina@mrshortsale.net', password: 'demo2026', name: 'Cristina Gaspar', role: 'CEO', icon: Crown, color: 'from-primary to-blue-700' },
  { email: 'maria@mrshortsale.net', password: 'demo2026', name: 'Maria Santos', role: 'Sales Rep', icon: Briefcase, color: 'from-teal-600 to-emerald-700' },
  { email: 'james@mrshortsale.net', password: 'demo2026', name: 'James Rivera', role: 'Sales Rep', icon: Briefcase, color: 'from-blue-500 to-indigo-600' },
  { email: 'luis@mrshortsale.net', password: 'demo2026', name: 'Luis Ortega', role: 'Sales Rep', icon: Briefcase, color: 'from-amber-600 to-orange-700' },
];

// ─── Sign In form ─────────────────────────────────────────────────────────────

function SignInForm({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth();
  const [serverError, setServerError] = useState('');
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: SignInValues) => {
    setServerError('');
    const result = await login(values.email, values.password);
    if (!result.success) {
      setServerError(result.error ?? 'Login failed. Please try again.');
    }
  };

  const handleQuickLogin = async (email: string, password: string) => {
    setServerError('');
    setLoadingDemo(email);
    const result = await login(email, password);
    if (!result.success) {
      setServerError(result.error ?? 'Login failed. Please try again.');
    }
    setLoadingDemo(null);
  };

  return (
    <>
      {serverError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-5">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@mrshortsale.net" type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input placeholder="••••••••" type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Sign In
          </Button>
        </form>
      </Form>

      {/* Demo accounts */}
      <div className="mt-6">
        <p className="text-xs text-muted-foreground text-center mb-3">Or try a demo account</p>
        <div className="space-y-2">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = account.icon;
            const isLoading = loadingDemo === account.email;
            return (
              <button
                key={account.email}
                onClick={() => handleQuickLogin(account.email, account.password)}
                disabled={isSubmitting || loadingDemo !== null}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 bg-white hover:border-primary/30 hover:shadow-md transition-all duration-200 group text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${account.color} flex items-center justify-center shrink-0`}>
                  {isLoading
                    ? <Loader2 size={14} className="text-white animate-spin" />
                    : <Icon className="w-4 h-4 text-white" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-xs">{account.name}</p>
                  <p className="text-muted-foreground text-[11px] truncate">{account.email}</p>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {account.role}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Don't have an account?{' '}
        <button onClick={onSwitch} className="text-primary font-semibold hover:underline">
          Sign up
        </button>
      </p>
    </>
  );
}

// ─── Sign Up form ─────────────────────────────────────────────────────────────

function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const { signup } = useAuth();
  const [serverError, setServerError] = useState('');

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: SignUpValues) => {
    setServerError('');
    const result = await signup(values.email, values.password, values.name);
    if (!result.success) {
      setServerError(result.error ?? 'Sign-up failed. Please try again.');
    }
  };

  return (
    <>
      {serverError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-5">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Smith" autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@mrshortsale.net" type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input placeholder="Min 8 chars, 1 uppercase, 1 number" type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input placeholder="••••••••" type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className="text-xs text-muted-foreground">
            New accounts are created as <span className="font-semibold">Sales Rep</span>. A CEO can change your role later.
          </p>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Create Account
          </Button>
        </form>
      </Form>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Already have an account?{' '}
        <button onClick={onSwitch} className="text-primary font-semibold hover:underline">
          Sign in
        </button>
      </p>
    </>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-primary/10 border border-white/60 p-8">
          <div className="flex flex-col items-center mb-7">
            <div className="bg-primary/5 p-3 rounded-2xl mb-4">
              <img src={logo} alt="Mr. Short Sale" className="h-14" />
            </div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">AI Operations Platform</h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>

          {mode === 'signin'
            ? <SignInForm onSwitch={() => setMode('signup')} />
            : <SignUpForm onSwitch={() => setMode('signin')} />
          }

          <p className="text-center text-xs text-muted-foreground mt-6">
            Mr. Short Sale · SJ Innovation · 2026
          </p>
        </div>
      </div>
    </div>
  );
}
