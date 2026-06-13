import { createClient } from '@supabase/supabase-js';

// Use placeholder values to prevent runtime crash during module loading if env vars are missing.
// The app will check if Supabase is actually configured before calling any Supabase functions.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Warning: Supabase URL and Anon Key are missing. Running in Offline Demo Mode using LocalStorage.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
