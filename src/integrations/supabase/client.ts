import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://abpxitlgresjdiwpmzbb.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFicHhpdGxncmVzamRpd3BtemJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjgzMjUsImV4cCI6MjA5NDI0NDMyNX0.mp2AeEzAD4bPrzuFXdBncgTAxfFqjdbVdhnhxYnMGug';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});