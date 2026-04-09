import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const appUrl = import.meta.env.VITE_APP_URL;

if (!supabaseUrl || !supabaseAnonKey || !appUrl) {
  throw new Error("Missing Supabase environment variables.");
}

function normalizeAppUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export const appBaseUrl = normalizeAppUrl(appUrl);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
