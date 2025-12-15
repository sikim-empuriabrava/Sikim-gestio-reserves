import { createClient } from '@supabase/supabase-js';

const SECURE_COOKIES = process.env.NODE_ENV === 'production';
const CHUNK_SIZE = 3800;

function getDefaultStorageKey(supabaseUrl) {
  const projectRef = new URL(supabaseUrl).host.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

function readChunks(prefix, getAll) {
  const all = getAll();
  const matches = all
    .filter((cookie) => cookie?.name?.startsWith(prefix))
    .map((cookie) => ({
      name: cookie.name,
      value: cookie.value ?? '',
    }));

  if (matches.length === 0) return null;

  const parts = matches
    .map((cookie) => {
      const suffix = cookie.name.slice(prefix.length);
      const index = Number(suffix.replace('-', ''));
      return { index: Number.isFinite(index) ? index : 0, value: cookie.value };
    })
    .sort((a, b) => a.index - b.index)
    .map((part) => part.value);

  return decodeURIComponent(parts.join(''));
}

function removeChunks(prefix, setCookie, getAll, options) {
  const matches = getAll().filter((cookie) => cookie?.name?.startsWith(prefix));
  matches.forEach((cookie) => {
    setCookie(cookie.name, '', {
      ...options,
      expires: new Date(0),
      maxAge: undefined,
    });
  });
}

function writeChunks(prefix, value, setCookie, getAll, options) {
  removeChunks(prefix, setCookie, getAll, options);

  const encoded = encodeURIComponent(value);
  const chunks = [];
  for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
    chunks.push(encoded.slice(i, i + CHUNK_SIZE));
  }

  chunks.forEach((chunk, index) => {
    setCookie(`${prefix}${index}`, chunk, options);
  });
}

function createCookieStorage(storageKey, cookieAdapter) {
  const baseOptions = {
    path: '/',
    sameSite: 'lax',
    secure: SECURE_COOKIES,
    maxAge: 60 * 60 * 24 * 7,
  };

  return {
    getItem: (key) => {
      if (key !== storageKey) return null;
      return readChunks(`${key}-`, cookieAdapter.getAll);
    },
    setItem: async (key, value) => {
      if (key !== storageKey) return;
      writeChunks(`${key}-`, value, cookieAdapter.setCookie, cookieAdapter.getAll, baseOptions);
    },
    removeItem: async (key) => {
      if (key !== storageKey) return;
      removeChunks(`${key}-`, cookieAdapter.setCookie, cookieAdapter.getAll, baseOptions);
    },
  };
}

function ensureStorageKey(options, supabaseUrl) {
  if (options?.auth?.storageKey) return options.auth.storageKey;
  return getDefaultStorageKey(supabaseUrl);
}

export function createBrowserClient(supabaseUrl, supabaseKey, options = {}) {
  const storageKey = ensureStorageKey(options, supabaseUrl);
  const cookieAdapter = {
    getAll: () => {
      if (typeof document === 'undefined') return [];
      return document.cookie
        .split('; ')
        .filter(Boolean)
        .map((entry) => {
          const [name, ...rest] = entry.split('=');
          return { name, value: rest.join('=') };
        });
    },
    setCookie: (name, value, opts) => {
      if (typeof document === 'undefined') return;
      const attributes = [
        `path=${opts?.path ?? '/'}`,
        `SameSite=${opts?.sameSite ?? 'lax'}`,
        (opts?.secure ?? SECURE_COOKIES) ? 'Secure' : '',
      ];

      if (opts?.maxAge) {
        attributes.push(`max-age=${opts.maxAge}`);
      }
      if (opts?.expires) {
        attributes.push(`expires=${opts.expires.toUTCString()}`);
      }

      document.cookie = `${name}=${value}; ${attributes.filter(Boolean).join('; ')}`;
    },
  };

  const auth = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey,
    storage: createCookieStorage(storageKey, cookieAdapter),
    ...options.auth,
  };

  return createClient(supabaseUrl, supabaseKey, { ...options, auth });
}

function createServerLikeClient(supabaseUrl, supabaseKey, options = {}, cookieAdapterFactory) {
  const storageKey = ensureStorageKey(options, supabaseUrl);
  const cookieAdapter = cookieAdapterFactory();
  const auth = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey,
    storage: createCookieStorage(storageKey, cookieAdapter),
    ...options.auth,
  };

  return createClient(supabaseUrl, supabaseKey, { ...options, auth });
}

export function createServerClient(supabaseUrl, supabaseKey, options = {}) {
  return createServerLikeClient(supabaseUrl, supabaseKey, options, () => options.cookies);
}

export function createRouteHandlerClient(supabaseUrl, supabaseKey, options = {}) {
  return createServerLikeClient(supabaseUrl, supabaseKey, options, () => options.cookies);
}

export function createMiddlewareClient(supabaseUrl, supabaseKey, options = {}) {
  return createServerLikeClient(supabaseUrl, supabaseKey, options, () => options.cookies);
}
