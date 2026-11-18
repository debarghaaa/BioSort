import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../contracts/database_types';

const runtimeEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
const supabaseUrl = runtimeEnv?.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = runtimeEnv?.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const EVIDENCE_BUCKET =
  runtimeEnv?.VITE_SUPABASE_EVIDENCE_BUCKET?.trim() || 'waste-evidence';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let clientInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}

export async function createEvidenceSignedUrl(
  objectPath: string,
  expiresInSeconds = 120
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client || !objectPath) return null;
  const { data, error } = await client.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(objectPath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}
