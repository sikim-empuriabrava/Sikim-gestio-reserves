const SUPABASE_URL_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'] as const;
const SUPABASE_ANON_KEY_KEYS = ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'] as const;

type SupabaseEnvValue = { key: string; value: string } | null;

function readEnvValue(keys: readonly string[]): SupabaseEnvValue {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed) return { key, value: trimmed };
  }

  return null;
}

export function getSupabaseUrl() {
  const url = readEnvValue(SUPABASE_URL_KEYS);
  if (!url) {
    throw new Error(`Missing ${SUPABASE_URL_KEYS.join(' or ')}`);
  }
  return url.value;
}

export function getSupabaseAnonKey() {
  const key = readEnvValue(SUPABASE_ANON_KEY_KEYS);
  if (!key) {
    throw new Error(`Missing ${SUPABASE_ANON_KEY_KEYS.join(' or ')}`);
  }
  return key.value;
}

export function getSupabaseEnvStatus() {
  const url = readEnvValue(SUPABASE_URL_KEYS);
  const anonKey = readEnvValue(SUPABASE_ANON_KEY_KEYS);

  return {
    url: url?.value ?? null,
    anonKey: anonKey?.value ?? null,
    missing: [
      ...(url ? [] : SUPABASE_URL_KEYS),
      ...(anonKey ? [] : SUPABASE_ANON_KEY_KEYS),
    ],
  };
}

export function getMissingSupabaseEnv() {
  return getSupabaseEnvStatus().missing;
}
