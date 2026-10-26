import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

let supabaseAdmin: SupabaseClient | null = null;

// Only initialize Supabase client if actual credentials are provided (non-dummy)
if (config.SUPABASE_URL && !config.SUPABASE_URL.includes('example.supabase.co')) {
  supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { supabaseAdmin };
