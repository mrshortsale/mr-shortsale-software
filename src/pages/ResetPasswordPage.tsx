import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Brain, CheckCircle2, Loader2, Moon, Sun } from 'lucide-react';
import * as authService from '@/services/auth';
import { useTheme } from '@/contexts/ThemeContext';
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
import { PasswordInput } from '@/components/auth/PasswordInput';

function buildResetSchema(t: (key: string) => string) {
  return z
    .object({
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

type ResetValues = { password: string; confirmPassword: string };

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const schema = buildResetSchema(t);
  const form = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: ResetValues) => {
    setServerError('');
    const result = await authService.resetPassword(token, values.password);
    if (!result.success) {
      setServerError(result.error ?? t('login.reset.resetFailed'));
      return;
    }
    setSuccess(true);
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

        <div className="w-full">
          {!token ? (
            <Card className="shadow-premium">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                  <p className="font-semibold text-foreground">{t('login.reset.invalidLinkTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('login.reset.invalidLinkDesc')}</p>
                  <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
                    {t('login.reset.backToSignIn')}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : success ? (
            <Card className="shadow-premium">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="font-semibold text-foreground">{t('login.reset.successTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('login.reset.successDesc')}</p>
                  <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
                    {t('login.reset.backToSignIn')}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-premium">
              <CardHeader>
                <CardTitle className="text-xl">{t('login.reset.title')}</CardTitle>
                <CardDescription>{t('login.reset.subtitle')}</CardDescription>
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
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            {t('login.reset.newPassword')}
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
                            {t('login.reset.confirmPassword')}
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
                          {t('login.reset.submitting')}
                        </>
                      ) : (
                        t('login.reset.submit')
                      )}
                    </Button>
                  </form>
                </Form>

                <p className="text-center text-xs text-muted-foreground">
                  <Link to="/login" className="font-semibold text-primary hover:underline">
                    {t('login.reset.backToSignIn')}
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          {t('login.footer')}
        </p>
      </div>
    </div>
  );
}
