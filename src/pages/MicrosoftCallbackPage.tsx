import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { storeToken } from '@/services/auth';
import { CEO_BASE } from '@/config/ceoNav';
import { REP_BASE } from '@/config/repNav';

const ERROR_MESSAGES: Record<string, string> = {
  account_pending_approval:
    'Your account is pending CEO approval. You will receive an email once approved.',
  account_disabled: 'Your account is disabled. Please contact support.',
  microsoft_consent_denied: 'Sign-in was cancelled.',
  microsoft_invalid_state: 'Session expired. Please try again.',
  microsoft_not_configured: 'Microsoft Sign-In is not configured on this server.',
  microsoft_auth_failed: 'Microsoft Sign-In failed. Please try again.',
};

export default function MicrosoftCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const error = params.get('error');
    if (error) {
      setErrorMessage(ERROR_MESSAGES[error] ?? 'Sign-in failed. Please try again.');
      return;
    }

    const token = params.get('token');
    if (!token) {
      setErrorMessage(ERROR_MESSAGES['microsoft_auth_failed']);
      return;
    }

    storeToken(token);
    refreshUser();
  }, [params, refreshUser]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'ceo') {
      navigate(`${CEO_BASE}/briefing`, { replace: true });
    } else {
      navigate(`${REP_BASE}/queue`, { replace: true });
    }
  }, [user, navigate]);

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
    </div>
  );
}
