import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from './auth';

const BASE_URL = `${SUPABASE_URL}/functions/v1`;

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

export type AuthMethod = 'api_key' | 'basic_auth' | 'oauth2' | 'inbound_webhook' | 'outbound_webhook' | 'none';
export type IntegrationStatus = 'connected' | 'disabled' | 'error';

export interface Integration {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  icon_url: string | null;
  auth_method: AuthMethod;
  is_builtin: boolean;
  default_base_url: string | null;
  health_check_endpoint: string | null;
  created_at: string;
  updated_at: string;
  credential_status: IntegrationStatus | null;
  credential_id: string | null;
  base_url: string | null;
  last_tested_at: string | null;
  last_test_status: 'success' | 'failure' | null;
  last_test_error: string | null;
}

export interface IntegrationCredentials {
  credentials: Record<string, string>;
  status: IntegrationStatus;
  base_url: string | null;
  webhook_secret: string | null;
  webhook_url: string | null;
  last_tested_at: string | null;
  last_test_status: 'success' | 'failure' | null;
  last_test_error: string | null;
}

export interface TestResult {
  success: boolean;
  latency_ms: number;
  status_code?: number;
  error?: string;
}

export interface ApiLogEntry {
  id: string;
  integration_id: string;
  credential_id: string | null;
  method: string;
  endpoint: string;
  status_code: number | null;
  latency_ms: number | null;
  request_size_bytes: number | null;
  response_size_bytes: number | null;
  error_message: string | null;
  direction: 'outbound' | 'inbound';
  created_at: string;
}

export interface CreateIntegrationPayload {
  name: string;
  slug?: string;
  description?: string;
  authMethod: AuthMethod;
  baseUrl?: string;
  credentials?: Record<string, string>;
}

export async function listIntegrations(): Promise<{ integrations?: Integration[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-manage`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch integrations' };
    return { integrations: data.integrations };
  } catch {
    return { error: 'Network error' };
  }
}

export async function createIntegration(payload: CreateIntegrationPayload): Promise<{ integration?: Integration; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'create', ...payload }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to create integration' };
    return { integration: data.integration };
  } catch {
    return { error: 'Network error' };
  }
}

export async function configureIntegration(
  integrationId: string,
  credentials: Record<string, string>,
  baseUrl?: string,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'configure', integrationId, credentials, baseUrl }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to configure integration' };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}

export async function toggleIntegration(integrationId: string, enabled: boolean): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'toggle', integrationId, enabled }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to toggle integration' };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}

export async function deleteIntegration(integrationId: string): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'delete', integrationId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to delete integration' };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}

export async function getCredentials(integrationId: string): Promise<{ data?: IntegrationCredentials; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'get_credentials', integrationId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch credentials' };
    return { data };
  } catch {
    return { error: 'Network error' };
  }
}

export async function testConnection(integrationId: string): Promise<{ result?: TestResult; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-test`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ integrationId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Connection test failed' };
    return { result: data };
  } catch {
    return { error: 'Network error' };
  }
}

export async function initiateOAuth(integrationId: string): Promise<{ authorizationUrl?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-oauth-callback`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ integrationId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to initiate OAuth' };
    return { authorizationUrl: data.authorizationUrl };
  } catch {
    return { error: 'Network error' };
  }
}

export async function getApiUsage(params?: {
  integrationId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs?: ApiLogEntry[]; total?: number; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (params?.integrationId) query.set('integration_id', params.integrationId);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const res = await fetch(`${BASE_URL}/integrations-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'get_api_usage', ...params }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch API usage' };
    return { logs: data.logs, total: data.total };
  } catch {
    return { error: 'Network error' };
  }
}

export async function updateIntegration(
  integrationId: string,
  updates: { name?: string; description?: string; baseUrl?: string },
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/integrations-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'update', integrationId, ...updates }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to update integration' };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}
