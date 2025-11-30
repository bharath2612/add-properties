// Cloudflare Pages Function to serve R2 files
// Route: /r2/* (catches all paths under /r2/)

interface Env {
  R2_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { R2_BUCKET } = context.env;

    if (!R2_BUCKET) {
      return new Response('R2 bucket not configured', { status: 500 });
    }

    // Get the file path from URL params
    const pathArray = context.params.path as string[];
    const key = pathArray.join('/');

    if (!key) {
      return new Response('Invalid path', { status: 400 });
    }

    // Fetch object from R2
    const object = await R2_BUCKET.get(key);

    if (!object) {
      return new Response('File not found', { status: 404 });
    }

    // Set up response headers
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    // Cache for 1 year (files have unique names with timestamps)
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    
    // CORS headers for cross-origin access
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    return new Response(object.body, { headers });

  } catch (error: any) {
    console.error('R2 fetch error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};

// Handle OPTIONS requests for CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};

