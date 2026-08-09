import { supabase } from './supabase';

/** Thin API client: attaches the Supabase JWT and, when acting for a clinic,
 *  the X-Clinic-Id header (Stage 3 §4 layer 2). */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; clinicId?: string } = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(`/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers: {
      // Content-Type only when there is a body: Fastify 400s on an empty JSON body.
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.clinicId ? { 'X-Clinic-Id': options.clinicId } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
