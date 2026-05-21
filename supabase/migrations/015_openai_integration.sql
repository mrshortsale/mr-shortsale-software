INSERT INTO public.integrations (name, slug, description, category, auth_method, is_builtin, default_base_url, health_check_endpoint)
VALUES (
  'OpenAI',
  'openai',
  'GPT models for text generation, chat, embeddings, and more via the OpenAI API.',
  'ai',
  'api_key',
  true,
  'https://api.openai.com',
  '/v1/models'
)
ON CONFLICT (slug) DO NOTHING;
