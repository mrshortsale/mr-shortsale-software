import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Loader2,
  Power,
  Trash2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  type Integration,
  type IntegrationCredentials,
  getCredentials,
  testConnection,
  toggleIntegration,
  deleteIntegration,
  configureIntegration,
  initiateOAuth,
} from '@/services/integrations';
import { toast } from 'sonner';

interface Props {
  integration: Integration;
  onBack: () => void;
}

export default function IntegrationConfigPanel({ integration, onBack }: Props) {
  const { i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';
  const [credentials, setCredentials] = useState<IntegrationCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCredentials();
  }, [integration.id]);

  const fetchCredentials = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    const { data, error } = await getCredentials(integration.id);
    if (error) {
      if (!error.includes('No credentials') && !options?.silent) {
        toast.error(error);
      }
    } else {
      setCredentials(data || null);
    }
    if (!options?.silent) setLoading(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const { result, error } = await testConnection(integration.id);
    setTesting(false);
    if (error) {
      toast.error(error);
      setTestResult({ success: false, latencyMs: 0, error });
    } else if (result) {
      setTestResult({ success: result.success, latencyMs: result.latency_ms, error: result.error });
      if (result.success) {
        toast.success(`Connection successful (${result.latency_ms}ms)`);
      } else {
        toast.error(result.error || 'Connection failed');
      }
      fetchCredentials({ silent: true });
    }
  };

  const handleToggle = async () => {
    const newEnabled = credentials?.status !== 'connected';
    setToggling(true);
    const { error } = await toggleIntegration(integration.id, newEnabled);
    setToggling(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success(newEnabled ? 'Integration enabled' : 'Integration disabled');
      fetchCredentials({ silent: true });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this integration? This cannot be undone.')) return;
    setDeleting(true);
    const { error } = await deleteIntegration(integration.id);
    setDeleting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Integration deleted');
      onBack();
    }
  };

  const handleSaveCredentials = async () => {
    const { _baseUrl, ...credentialFields } = editFields;
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(credentialFields)) {
      if (v.trim()) payload[k] = v.trim();
    }
    const { error } = await configureIntegration(integration.id, payload, _baseUrl?.trim());
    if (error) {
      toast.error(error);
    } else {
      toast.success('Credentials updated');
      setEditMode(false);
      fetchCredentials();
    }
  };

  const handleOAuth = async () => {
    const { authorizationUrl, error } = await initiateOAuth(integration.id);
    if (error) {
      toast.error(error);
    } else if (authorizationUrl) {
      window.location.href = authorizationUrl;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const isConnected = credentials?.status === 'connected';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h2 className="text-xl font-semibold">{integration.name}</h2>
          <p className="text-xs text-muted-foreground font-mono">{integration.slug}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {isConnected ? 'Connected' : credentials?.status === 'error' ? 'Error' : 'Disabled'}
                </p>
                {credentials?.last_tested_at && (
                  <p className="text-xs text-muted-foreground">
                    Last tested: {new Date(credentials.last_tested_at).toLocaleString(loc)}
                  </p>
                )}
              </div>
            </div>

            {credentials?.last_test_error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-xs text-red-700 dark:text-red-400">{credentials.last_test_error}</p>
              </div>
            )}

            {testResult && (
              <div className={`rounded-md p-3 ${testResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <p className={`text-xs font-medium ${testResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  {testResult.success ? `Connected successfully (${testResult.latencyMs}ms)` : testResult.error}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !credentials}>
                {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Test Connection
              </Button>
              <Button
                size="sm"
                variant={isConnected ? 'outline' : 'default'}
                onClick={handleToggle}
                disabled={toggling || !credentials}
              >
                {toggling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Power className="mr-1.5 h-3.5 w-3.5" />}
                {isConnected ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Category</p>
                <p className="font-medium capitalize">{integration.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Auth Method</p>
                <p className="font-medium">{integration.auth_method.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Type</p>
                <Badge variant="outline" className="text-xs">{integration.is_builtin ? 'Built-in' : 'Custom'}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Base URL</p>
                <p className="font-mono text-xs truncate">{credentials?.base_url || integration.default_base_url || '—'}</p>
              </div>
            </div>
            {integration.description && (
              <div className="pt-2">
                <p className="text-muted-foreground text-xs">Description</p>
                <p className="text-sm mt-1">{integration.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credentials Card */}
        {loading ? (
          <Card className="lg:col-span-2">
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Credentials</CardTitle>
                {!editMode && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditMode(true);
                    setEditFields({
                      _baseUrl:
                        credentials?.base_url ||
                        integration.base_url ||
                        integration.default_base_url ||
                        '',
                    });
                  }}>
                    {credentials ? 'Edit Credentials' : 'Add Credentials'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editMode ? (
                <form
                  className="space-y-4"
                  autoComplete="off"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveCredentials();
                  }}
                >
                  {integration.auth_method === 'api_key' && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`${integration.slug}-api-token`}>API Key</Label>
                      <Input
                        id={`${integration.slug}-api-token`}
                        name={`integration-${integration.slug}-api-token`}
                        type="text"
                        autoComplete="off"
                        data-1p-ignore
                        data-lpignore="true"
                        data-form-type="other"
                        className="font-mono"
                        placeholder="Leave blank to keep current key"
                        value={editFields.apiKey || ''}
                        onChange={(e) => setEditFields({ ...editFields, apiKey: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        For security, stored keys are never shown. Leave empty to keep the existing key, or enter a new one to replace it.
                      </p>
                    </div>
                  )}
                  {integration.auth_method === 'basic_auth' && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Username</Label>
                        <Input
                          placeholder="Username"
                          value={editFields.username || ''}
                          onChange={(e) => setEditFields({ ...editFields, username: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          placeholder="Password"
                          value={editFields.password || ''}
                          onChange={(e) => setEditFields({ ...editFields, password: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  {integration.auth_method === 'oauth2' && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Client ID</Label>
                        <Input
                          placeholder="OAuth Client ID"
                          value={editFields.clientId || ''}
                          onChange={(e) => setEditFields({ ...editFields, clientId: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Client Secret</Label>
                        <Input
                          type="password"
                          placeholder="OAuth Client Secret"
                          value={editFields.clientSecret || ''}
                          onChange={(e) => setEditFields({ ...editFields, clientSecret: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Authorization URL</Label>
                        <Input
                          placeholder="https://provider.com/oauth/authorize"
                          value={editFields.authorizationUrl || ''}
                          onChange={(e) => setEditFields({ ...editFields, authorizationUrl: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Token URL</Label>
                        <Input
                          placeholder="https://provider.com/oauth/token"
                          value={editFields.tokenUrl || ''}
                          onChange={(e) => setEditFields({ ...editFields, tokenUrl: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  {integration.auth_method === 'inbound_webhook' && (
                    <>
                      <p className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">
                        Save these credentials first, then copy the <strong>Webhook URL</strong> shown below and paste it into your Meta App webhook settings along with your Verify Token.
                      </p>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${integration.slug}-app-id`}>App ID</Label>
                        <Input
                          id={`${integration.slug}-app-id`}
                          placeholder="Meta App ID (numeric)"
                          value={editFields.appId || ''}
                          onChange={(e) => setEditFields({ ...editFields, appId: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${integration.slug}-app-secret`}>App Secret</Label>
                        <Input
                          id={`${integration.slug}-app-secret`}
                          type="password"
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          placeholder="Leave blank to keep current secret"
                          value={editFields.appSecret || ''}
                          onChange={(e) => setEditFields({ ...editFields, appSecret: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Stored as the HMAC key to verify incoming webhook signatures. Never exposed in plain text.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${integration.slug}-verify-token`}>Verify Token</Label>
                        <Input
                          id={`${integration.slug}-verify-token`}
                          placeholder="e.g. mss-meta-verify-2026"
                          value={editFields.verifyToken || ''}
                          onChange={(e) => setEditFields({ ...editFields, verifyToken: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Arbitrary string you choose. Must match exactly when registering the webhook in the Meta App dashboard.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${integration.slug}-page-token`}>Page Access Token</Label>
                        <Input
                          id={`${integration.slug}-page-token`}
                          type="password"
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          placeholder="Leave blank to keep current token"
                          value={editFields.pageAccessToken || ''}
                          onChange={(e) => setEditFields({ ...editFields, pageAccessToken: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Used to call the Graph API and retrieve lead form field data. Generate in the Graph API Explorer with <code>leads_retrieval</code> + <code>pages_read_engagement</code> permissions.
                        </p>
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor={`${integration.slug}-base-url`}>Base URL</Label>
                    <Input
                      id={`${integration.slug}-base-url`}
                      name={`integration-${integration.slug}-base-url`}
                      type="url"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      data-form-type="other"
                      placeholder="https://app.batchleads.io"
                      value={editFields._baseUrl || ''}
                      onChange={(e) =>
                        setEditFields({
                          ...editFields,
                          _baseUrl: e.target.value.replace(/\/+$/, ''),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Host only (e.g. https://app.batchleads.io). Do not end with a forward slash or include paths like /api/v1/tags.
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" size="sm">Save</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </form>
              ) : credentials ? (
                <div className="space-y-3">
                  {Object.entries(credentials.credentials).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="font-mono text-sm">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No credentials configured yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Webhook URL Card */}
        {integration.auth_method === 'inbound_webhook' && credentials?.webhook_url && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Webhook URL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={credentials.webhook_url}
                  className="font-mono text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(credentials.webhook_url!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Paste this URL into the external service to start receiving events.
              </p>
            </CardContent>
          </Card>
        )}

        {/* OAuth Authorize Button */}
        {integration.auth_method === 'oauth2' && credentials && !isConnected && (
          <Card className="lg:col-span-2">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-sm">OAuth Authorization Required</p>
                <p className="text-xs text-muted-foreground">
                  Click "Authorize" to connect this integration via OAuth 2.0.
                </p>
              </div>
              <Button onClick={handleOAuth}>
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Authorize
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete */}
      {!integration.is_builtin && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-destructive">Danger Zone</p>
              <p className="text-xs text-muted-foreground">Permanently delete this integration and all its data.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Delete Integration
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
