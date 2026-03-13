/**
 * Supabase Proxy — Vercel Serverless Function
 *
 * Routes admin dashboard queries through the service_role key so the
 * browser never sees the secret. After the RLS-hardening migration,
 * the anon key can no longer read analytics / admin tables.
 *
 * All /api/sp/* requests are rewritten to this function via vercel.json.
 * The original path is preserved in x-matched-path or parsed from the URL.
 *
 * Required Vercel env vars (set in Dashboard → Settings → Environment Variables):
 *   VITE_SUPABASE_URL     – e.g. https://svapyzcfldheymahioor.supabase.co
 *   VITE_SUPABASE_SERVICE – the service_role JWT
 */

export const config = { runtime: 'edge' };

const FORWARDED_HEADERS = [
  'accept',
  'content-type',
  'prefer',
  'range',
  'x-client-info',
  'accept-profile',
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
  // Debug mode: /api/sp/rest/v1/properties?__debug=1
  const debugUrl = new URL(request.url);
  if (debugUrl.searchParams.has('__debug')) {
    const info: Record<string, unknown> = {
      url: request.url,
      pathname: debugUrl.pathname,
      search: debugUrl.search,
      searchParams: Object.fromEntries(debugUrl.searchParams),
    };
    // Show what targetUrl would be
    const sp = debugUrl.searchParams.get('__path') || '';
    const pathFromUrl = debugUrl.pathname.match(/^\/api\/sp\/(.+)$/)?.[1] || '';
    info.subPath_from_query = sp;
    info.subPath_from_pathname = pathFromUrl;
    return new Response(JSON.stringify(info, null, 2), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({
        error: 'Supabase proxy not configured.',
        hint: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE in Vercel env vars.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }

  // Vercel preserves the original pathname even after rewrite.
  // Extract the Supabase sub-path from the URL pathname.
  const url = new URL(request.url);
  const pathMatch = url.pathname.match(/^\/api\/sp\/(.+)$/);
  const subPath = pathMatch ? pathMatch[1] : '';

  // Vercel injects __path and path params from the rewrite — strip them
  const cleanParams = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key !== '__path' && key !== 'path' && key !== '__debug') {
      cleanParams.append(key, value);
    }
  });
  const cleanSearch = cleanParams.toString() ? `?${cleanParams.toString()}` : '';
  const targetUrl = `${supabaseUrl}/${subPath}${cleanSearch}`;

  // Build headers with service_role auth
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

  // Forward to Supabase
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
  });

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
