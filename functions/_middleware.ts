// Cloudflare Pages Functions Middleware
// This runs on every request and ensures correct MIME types

export async function onRequest(context: any) {
  // Get the response from the asset
  const response = await context.next();
  
  // Get the URL path
  const url = new URL(context.request.url);
  const path = url.pathname;
  
  // Clone the response so we can modify headers
  const newResponse = new Response(response.body, response);
  
  // Set correct Content-Type based on file extension
  if (path.endsWith('.js')) {
    newResponse.headers.set('Content-Type', 'text/javascript; charset=utf-8');
  } else if (path.endsWith('.css')) {
    newResponse.headers.set('Content-Type', 'text/css; charset=utf-8');
  } else if (path.endsWith('.html')) {
    newResponse.headers.set('Content-Type', 'text/html; charset=utf-8');
  } else if (path.endsWith('.json')) {
    newResponse.headers.set('Content-Type', 'application/json; charset=utf-8');
  } else if (path.endsWith('.svg')) {
    newResponse.headers.set('Content-Type', 'image/svg+xml');
  } else if (path.endsWith('.png')) {
    newResponse.headers.set('Content-Type', 'image/png');
  } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
    newResponse.headers.set('Content-Type', 'image/jpeg');
  } else if (path.endsWith('.webp')) {
    newResponse.headers.set('Content-Type', 'image/webp');
  }
  
  // Add security headers
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  
  return newResponse;
}

