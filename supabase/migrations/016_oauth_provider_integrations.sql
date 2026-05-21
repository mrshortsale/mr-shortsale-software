-- Register Google Sign-In and Microsoft Sign-In as built-in integrations
-- so their OAuth credentials can be managed via the existing integrations system.
INSERT INTO public.integrations (name, slug, description, category, auth_method, is_builtin)
VALUES
  ('Google Sign-In', 'google-signin', 'OAuth 2.0 login via Google. Store clientId and clientSecret here.', 'auth', 'oauth2', true),
  ('Microsoft Sign-In', 'microsoft-signin', 'OAuth 2.0 login via Microsoft Azure AD. Store clientId and clientSecret here.', 'auth', 'oauth2', true)
ON CONFLICT (slug) DO NOTHING;
