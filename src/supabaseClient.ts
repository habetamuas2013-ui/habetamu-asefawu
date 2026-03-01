import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase credentials missing. Data will not be saved permanently until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in the Secrets panel.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
