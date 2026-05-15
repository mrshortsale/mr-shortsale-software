import { useState } from 'react';
import { Webhook, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createIntegration, type AuthMethod } from '@/services/integrations';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const BASE_URL_HINT =
  'Host only (e.g. https://app.batchleads.io). Do not end with a forward slash or include API paths.';

const AUTH_METHODS: { value: AuthMethod; label: string }[] = [
  { value: 'api_key', label: 'API Key / Token' },
  { value: 'basic_auth', label: 'Basic Auth' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'inbound_webhook', label: 'Inbound Webhook' },
  { value: 'none', label: 'No Authentication' },
];

export default function AddIntegrationModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('api_key');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const [tokenUrl, setTokenUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setAuthMethod('api_key');
    setBaseUrl('');
    setApiKey('');
    setUsername('');
    setPassword('');
    setClientId('');
    setClientSecret('');
    setAuthorizationUrl('');
    setTokenUrl('');
  };

  const generateSlug = (value: string) => {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const buildCredentials = (): Record<string, string> => {
    switch (authMethod) {
      case 'api_key':
        return apiKey ? { apiKey } : {};
      case 'basic_auth':
        return { username, password };
      case 'oauth2':
        return {
          clientId,
          clientSecret,
          authorizationUrl,
          tokenUrl,
        };
      case 'inbound_webhook':
      case 'none':
        return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Display name is required');
      return;
    }

    setSubmitting(true);
    const { error } = await createIntegration({
      name: name.trim(),
      slug: slug || undefined,
      description: description || undefined,
      authMethod,
      baseUrl: baseUrl || undefined,
      credentials: buildCredentials(),
    });

    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Integration created successfully');
      resetForm();
      onCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Integration</DialogTitle>
          <DialogDescription>
            Register any external service not in the built-in catalog.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="int-name">Display Name *</Label>
            <Input
              id="int-name"
              placeholder="e.g. Zendesk, HubSpot, My Webhook"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(generateSlug(e.target.value));
              }}
              required
            />
          </div>

          {/* Integration ID / Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="int-slug">Integration ID *</Label>
            <Input
              id="int-slug"
              placeholder="auto-generated-slug"
              value={slug}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Lowercase, no spaces.</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="int-desc">Description</Label>
            <Textarea
              id="int-desc"
              placeholder="What does this integration do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Auth Method */}
          <div className="space-y-1.5">
            <Label>Authentication Method *</Label>
            <Select value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTH_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic fields based on auth method */}
          {authMethod === 'api_key' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="int-apikey">API Key *</Label>
                <Input
                  id="int-apikey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-baseurl">Base URL</Label>
                <Input
                  id="int-baseurl"
                  placeholder="https://api.example.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value.replace(/\/+$/, ''))}
                />
                <p className="text-xs text-muted-foreground">Optional. {BASE_URL_HINT}</p>
              </div>
            </>
          )}

          {authMethod === 'basic_auth' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="int-username">Username *</Label>
                <Input
                  id="int-username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-password">Password *</Label>
                <Input
                  id="int-password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-baseurl-basic">Base URL</Label>
                <Input
                  id="int-baseurl-basic"
                  placeholder="https://api.example.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value.replace(/\/+$/, ''))}
                />
                <p className="text-xs text-muted-foreground">Optional. {BASE_URL_HINT}</p>
              </div>
            </>
          )}

          {authMethod === 'oauth2' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="int-clientid">Client ID *</Label>
                <Input
                  id="int-clientid"
                  placeholder="OAuth Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-clientsecret">Client Secret *</Label>
                <Input
                  id="int-clientsecret"
                  type="password"
                  placeholder="OAuth Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-authurl">Authorization URL</Label>
                <Input
                  id="int-authurl"
                  placeholder="https://provider.com/oauth/authorize"
                  value={authorizationUrl}
                  onChange={(e) => setAuthorizationUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Optional. The OAuth authorization endpoint.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-tokenurl">Token URL</Label>
                <Input
                  id="int-tokenurl"
                  placeholder="https://provider.com/oauth/token"
                  value={tokenUrl}
                  onChange={(e) => setTokenUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Optional. The OAuth token exchange endpoint.</p>
              </div>
            </>
          )}

          {authMethod === 'inbound_webhook' && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
              <Webhook className="mt-0.5 h-5 w-5 text-primary shrink-0" />
              <p className="text-sm text-muted-foreground">
                After saving, a webhook URL will be available on the configuration page.
                Paste it into the external service to start receiving events.
              </p>
            </div>
          )}

          {authMethod === 'none' && (
            <div className="space-y-1.5">
              <Label htmlFor="int-baseurl-none">Base URL</Label>
              <Input
                id="int-baseurl-none"
                placeholder="https://api.example.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value.replace(/\/+$/, ''))}
              />
              <p className="text-xs text-muted-foreground">Optional. {BASE_URL_HINT}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Integration'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
