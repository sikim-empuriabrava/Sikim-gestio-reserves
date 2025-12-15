import { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';

type Cookie = { name: string; value?: string };

type CookieAdapter = {
  getAll: () => Cookie[];
  setCookie: (name: string, value: string, options?: { path?: string; sameSite?: 'lax' | 'strict' | 'none'; secure?: boolean; maxAge?: number; expires?: Date }) => void;
};

type BaseOptions = SupabaseClientOptions<string> & {
  cookies?: CookieAdapter;
};

export function createBrowserClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<string>,
): SupabaseClient;

export function createServerClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: BaseOptions,
): SupabaseClient;

export function createRouteHandlerClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: BaseOptions,
): SupabaseClient;

export function createMiddlewareClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: BaseOptions,
): SupabaseClient;
