import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { isSignupDomainEmail } from '@/lib/emailValidation';
import { PasswordInput } from '@/components/auth/PasswordInput';
import * as authService from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// ─── OAuth error codes → human-readable messages ─────────────────────────────

const AUTH_ERRORS: Record<string, string> = {
  account_disabled: 'Your account is disabled. Please contact support.',
  google_consent_denied: 'Sign-in was cancelled.',
  google_invalid_state: 'Session expired. Please try again.',
  google_not_configured: 'Google Sign-In is not configured on this server.',
  google_auth_failed: 'Google Sign-In failed. Please try again.',
  microsoft_consent_denied: 'Sign-in was cancelled.',
  microsoft_invalid_state: 'Session expired. Please try again.',
  microsoft_not_configured: 'Microsoft Sign-In is not configured on this server.',
  microsoft_auth_failed: 'Microsoft Sign-In failed. Please try again.',
};

// ─── Zod schema builders ──────────────────────────────────────────────────────

function buildSignInSchema(t: (key: string) => string) {
  return z.object({
    email: z
      .string()
      .min(1, t('login.validation.emailRequired'))
      .email(t('login.validation.emailInvalid')),
    password: z.string().min(6, t('login.validation.passwordMinSignIn')),
  });
}

function buildSignUpSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(2, t('login.validation.nameMin')),
      email: z
        .string()
        .min(1, t('login.validation.emailRequired'))
        .email(t('login.validation.emailInvalid'))
        .transform((v) => v.trim().toLowerCase())
        .refine(isSignupDomainEmail, { message: t('login.validation.emailDomain') }),
      password: z
        .string()
        .min(8, t('login.validation.passwordMin'))
        .regex(/[A-Z]/, t('login.validation.passwordUppercase'))
        .regex(/[0-9]/, t('login.validation.passwordNumber')),
      confirmPassword: z.string().min(1, t('login.validation.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('login.validation.passwordsMismatch'),
      path: ['confirmPassword'],
    });
}

type SignInValues = { email: string; password: string };
type SignUpValues = { name: string; email: string; password: string; confirmPassword: string };
type ForgotPasswordValues = {
  email: string;
  currentPassword: string;
  password: string;
  confirmPassword: string;
};

// ─── Sign In form ─────────────────────────────────────────────────────────────

function SignInForm({
  onSwitch,
  onForgotPassword,
}: {
  onSwitch: () => void;
  onForgotPassword: () => void;
}) {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState('');
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const [urlParams] = useSearchParams();

  useEffect(() => {
    const code = urlParams.get('error');
    if (code && AUTH_ERRORS[code]) setServerError(AUTH_ERRORS[code]);
  }, [urlParams]);

  const schema = buildSignInSchema(t);
  const form = useForm<SignInValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const isSubmitting = form.formState.isSubmitting;
  const disabledAll = isSubmitting || loadingDemo !== null;

  const onSubmit = async (values: SignInValues) => {
    setServerError('');
    const result = await login(values.email, values.password);
    if (!result.success) {
      setServerError(result.error ?? t('login.signIn.loginFailed'));
    }
  };

  const handleQuickLogin = async (email: string, password: string) => {
    setServerError('');
    setLoadingDemo(email);
    const result = await login(email, password);
    if (!result.success) {
      setServerError(result.error ?? t('login.signIn.loginFailed'));
    }
    setLoadingDemo(null);
  };
  void handleQuickLogin;

  return (
    <div className="space-y-6">
      <Card className="shadow-premium">
        <CardHeader>
          <CardTitle className="text-xl">{t('login.signIn.title')}</CardTitle>
          <CardDescription>{t('login.signIn.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
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
                    <FormLabel className="text-sm font-medium">
                      {t('login.signIn.email')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('login.signIn.emailPlaceholder')}
                        type="email"
                        autoComplete="email"
                        className="h-10"
                        {...field}
                      />
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
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-medium">
                        {t('login.signIn.password')}
                      </FormLabel>
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {t('login.signIn.forgotPassword')}
                      </button>
                    </div>
                    <FormControl>
                      <PasswordInput
                        placeholder={t('login.signIn.passwordPlaceholder')}
                        autoComplete="current-password"
                        className="h-10"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="h-10 w-full font-medium"
                disabled={disabledAll}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('login.signIn.submitting')}
                  </>
                ) : (
                  t('login.signIn.submit')
                )}
              </Button>
            </form>
          </Form>

          <p className="text-center text-xs text-muted-foreground">
            {t('login.signIn.noAccount')}{' '}
            <button
              type="button"
              onClick={onSwitch}
              className="font-semibold text-primary hover:underline"
            >
              {t('login.signIn.switchToSignUp')}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Change password form (email + current password; no email link) ───────────

function buildForgotPasswordSchema(t: (key: string) => string) {
  return z
    .object({
      email: z
        .string()
        .min(1, t('login.validation.emailRequired'))
        .email(t('login.validation.emailInvalid')),
      currentPassword: z.string().min(1, t('login.validation.currentPasswordRequired')),
      password: z
        .string()
        .min(8, t('login.validation.passwordMin'))
        .regex(/[A-Z]/, t('login.validation.passwordUppercase'))
        .regex(/[0-9]/, t('login.validation.passwordNumber')),
      confirmPassword: z.string().min(1, t('login.validation.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('login.validation.passwordsMismatch'),
      path: ['confirmPassword'],
    })
    .refine((data) => data.password !== data.currentPassword, {
      message: t('login.validation.passwordSameAsCurrent'),
      path: ['password'],
    });
}

function ForgotPasswordForm({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState('');

  const schema = buildForgotPasswordSchema(t);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', currentPassword: '', password: '', confirmPassword: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: ForgotPasswordValues) => {
    setServerError('');
    const result = await authService.forgotPassword(
      values.email,
      values.currentPassword,
      values.password,
    );
    if (!result.success) {
      setServerError(result.error ?? t('login.forgot.requestFailed'));
      return;
    }
    onSent(result.message ?? t('login.forgot.sentDefault'));
  };

  return (
    <Card className="shadow-premium">
      <CardHeader>
        <CardTitle className="text-xl">{t('login.forgot.title')}</CardTitle>
        <CardDescription>{t('login.forgot.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {serverError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
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
                  <FormLabel className="text-sm font-medium">
                    {t('login.signIn.email')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('login.signIn.emailPlaceholder')}
                      type="email"
                      autoComplete="email"
                      className="h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t('login.forgot.currentPassword')}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder={t('login.forgot.currentPasswordPlaceholder')}
                      autoComplete="current-password"
                      className="h-10"
                      {...field}
                    />
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
                  <FormLabel className="text-sm font-medium">
                    {t('login.forgot.newPassword')}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder={t('login.signUp.passwordPlaceholder')}
                      autoComplete="new-password"
                      className="h-10"
                      {...field}
                    />
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
                  <FormLabel className="text-sm font-medium">
                    {t('login.forgot.confirmPassword')}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder={t('login.signUp.confirmPasswordPlaceholder')}
                      autoComplete="new-password"
                      className="h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="h-10 w-full font-medium" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('login.forgot.submitting')}
                </>
              ) : (
                t('login.forgot.submit')
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-xs text-muted-foreground">
          <button
            type="button"
            onClick={onBack}
            className="font-semibold text-primary hover:underline"
          >
            {t('login.forgot.backToSignIn')}
          </button>
        </p>
      </CardContent>
    </Card>
  );
}

function ForgotPasswordSentCard({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="shadow-premium">
      <CardContent className="pt-8 pb-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{t('login.forgot.sentTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="mt-2 text-sm font-semibold text-primary hover:underline"
          >
            {t('login.forgot.backToSignIn')}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sign Up form ─────────────────────────────────────────────────────────────

function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const { signup } = useAuth();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');

  const schema = buildSignUpSchema(t);
  const form = useForm<SignUpValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: SignUpValues) => {
    setServerError('');
    setPendingMessage('');
    const result = await signup(values.email, values.password, values.name);
    if (!result.success) {
      setServerError(result.error ?? t('login.signUp.signUpFailed'));
      return;
    }
    if (result.pendingApproval) {
      setPendingMessage(result.message ?? t('login.pending.defaultMessage'));
      form.reset();
    }
  };

  if (pendingMessage) {
    return (
      <Card className="shadow-premium">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('login.pending.title')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{pendingMessage}</p>
            </div>
            <button
              type="button"
              onClick={onSwitch}
              className="mt-2 text-sm font-semibold text-primary hover:underline"
            >
              {t('login.pending.backToSignIn')}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-premium">
      <CardHeader>
        <CardTitle className="text-xl">{t('login.signUp.title')}</CardTitle>
        <CardDescription>{t('login.signUp.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {serverError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
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
                  <FormLabel className="text-sm font-medium">
                    {t('login.signUp.fullName')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('login.signUp.fullNamePlaceholder')}
                      autoComplete="name"
                      className="h-10"
                      {...field}
                    />
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
                  <FormLabel className="text-sm font-medium">
                    {t('login.signUp.email')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('login.signUp.emailPlaceholder')}
                      type="email"
                      autoComplete="email"
                      className="h-10"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{t('login.signUp.emailHint')}</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t('login.signUp.password')}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder={t('login.signUp.passwordPlaceholder')}
                      autoComplete="new-password"
                      className="h-10"
                      {...field}
                    />
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
                  <FormLabel className="text-sm font-medium">
                    {t('login.signUp.confirmPassword')}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder={t('login.signUp.confirmPasswordPlaceholder')}
                      autoComplete="new-password"
                      className="h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="h-10 w-full font-medium" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('login.signUp.submitting')}
                </>
              ) : (
                t('login.signUp.submit')
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-xs text-muted-foreground">
          {t('login.signUp.haveAccount')}{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="font-semibold text-primary hover:underline"
          >
            {t('login.signUp.switchToSignIn')}
          </button>
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Pending approval card ────────────────────────────────────────────────────

function PendingApprovalCard({ onBack }: { onBack: () => void }) {
  return (
    <Card className="shadow-premium">
      <CardContent className="pt-8 pb-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <CheckCircle2 className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">Account pending approval</p>
            <p className="text-sm text-muted-foreground">
              Your account has been created and is awaiting CEO approval.
              <br />
              You'll be able to sign in once it's approved.
            </p>
          </div>
          <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              If you believe this is taking too long, please contact your administrator.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="mt-1 text-sm font-semibold text-primary hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'forgot-sent'>('signin');
  const [forgotMessage, setForgotMessage] = useState('');
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [urlParams, setUrlParams] = useSearchParams();

  const isPending = urlParams.get('error') === 'account_pending_approval';

  const clearPending = () => {
    setUrlParams({}, { replace: true });
    setMode('signin');
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="bg-ai-mesh absolute inset-0 pointer-events-none" aria-hidden />

      <div className="absolute right-4 top-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9"
          aria-label={theme === 'light' ? t('login.switchToDark') : t('login.switchToLight')}
        >
          {theme === 'light' ? (
            <Moon className="h-[18px] w-[18px]" />
          ) : (
            <Sun className="h-[18px] w-[18px]" />
          )}
        </Button>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex flex-col items-center">
          <div className="ai-gradient flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground shadow-ai">
            <Brain className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            {t('login.appName')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('login.appSubtitle')}</p>
        </div>

        <div className="w-full space-y-6">
          {isPending ? (
            <PendingApprovalCard onBack={clearPending} />
          ) : mode === 'forgot-sent' ? (
            <ForgotPasswordSentCard
              message={forgotMessage}
              onBack={() => {
                setMode('signin');
                setForgotMessage('');
              }}
            />
          ) : mode === 'forgot' ? (
            <ForgotPasswordForm
              onBack={() => setMode('signin')}
              onSent={(message) => {
                setForgotMessage(message);
                setMode('forgot-sent');
              }}
            />
          ) : mode === 'signin' ? (
            <SignInForm
              onSwitch={() => setMode('signup')}
              onForgotPassword={() => setMode('forgot')}
            />
          ) : (
            <SignUpForm onSwitch={() => setMode('signin')} />
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          {t('login.footer')}
        </p>
      </div>
    </div>
  );
}
