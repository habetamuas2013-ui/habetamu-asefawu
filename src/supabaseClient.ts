import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://scprzpdvmfmcdhjigrjw.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_l5tbI25sru3sXRK0-KEVNQ_W2dbMRH0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
