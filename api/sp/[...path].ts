/**
 * Supabase Proxy — Vercel Edge Function
 *
 * Routes admin dashboard queries through the service_role key so the
 * browser never sees the secret. After the RLS-hardening migration,
 * the anon key can no longer read analytics / admin tables.
 *
 * Required Vercel env vars (set in Dashboard → Settings → Environment Variables):
 *   SUPABASE_URL              – e.g. https://svapyzcfldheymahioor.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY – the service_role JWT
 */

export const config = { runtime: 'edge' };

// Headers we forward from the Supabase JS client to PostgREST
const FORWARDED_HEADERS = [
  'accept',
  'content-type',
  'prefer',           // count, return=representation, etc.
  'range',            // pagination
  'x-client-info',    // Supabase client version
  'accept-profile',   // PostgREST schema selection
  'content-profile',
];

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, apikey, Prefer, Range, X-Client-Info, Accept-Profile, Content-Profile',
  'Access-Control-Expose-Headers': 'Content-Range, X-Total-Count',
  'Access-Control-Max-Age': '86400',
};

export default async function handler(request: Request) {
  // --- CORS preflight ---
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({
        error: 'Supabase proxy not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }

  // --- Extract the path after /api/sp/ ---
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/sp\/(.*)$/);
  const subPath = match ? match[1] : '';
  const targetUrl = `${supabaseUrl}/${subPath}${url.search}`;

  // --- Build forwarded headers with service_role auth ---
  const headers = new Headers();
  headers.set('apikey', serviceRoleKey);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);

  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (!headers.has('content-type') && !['GET', 'HEAD'].includes(request.method)) {
    headers.set('content-type', 'application/json');
  }

  // --- Forward the request ---
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
  });

  // --- Return response with CORS ---
  const responseHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    responseHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
