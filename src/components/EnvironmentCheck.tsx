import { ReactNode } from 'react';

interface EnvironmentCheckProps {
  children: ReactNode;
}

export function EnvironmentCheck({ children }: EnvironmentCheckProps) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const accessCode = import.meta.env.VITE_PROPERTY_ENTRY_ACCESS_CODE;

  const missingVars: string[] = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  if (!accessCode) missingVars.push('VITE_PROPERTY_ENTRY_ACCESS_CODE');

  // Always log to console
  console.log('=== ENVIRONMENT CHECK ===');
  console.log('Supabase URL:', supabaseUrl ? '✓ Set' : '✗ MISSING');
  console.log('Supabase Key:', supabaseKey ? '✓ Set' : '✗ MISSING');
  console.log('Access Code:', accessCode ? '✓ Set' : '✗ MISSING');
  console.log('========================');

  if (missingVars.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 border-4 border-red-500">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
              <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Environment Variables Missing
            </h1>
            <p className="text-gray-600">
              The application cannot start because required environment variables are not configured.
            </p>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <h2 className="font-semibold text-red-800 mb-2">Missing Variables:</h2>
            <ul className="list-disc list-inside space-y-1">
              {missingVars.map((varName) => (
                <li key={varName} className="text-red-700 font-mono text-sm">
                  {varName}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="font-semibold text-blue-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How to Fix (Cloudflare Pages)
            </h2>
            <ol className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="font-bold mr-2 min-w-[1.5rem]">1.</span>
                <span>Go to Cloudflare Dashboard → Workers & Pages → Your Project</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2 min-w-[1.5rem]">2.</span>
                <span>Click <strong>Settings</strong> → <strong>Environment Variables</strong></span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2 min-w-[1.5rem]">3.</span>
                <span>Add the missing variables listed above</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2 min-w-[1.5rem]">4.</span>
                <span>Redeploy your application</span>
              </li>
            </ol>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm">Example Configuration:</h3>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto font-mono">
              {`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
VITE_PROPERTY_ENTRY_ACCESS_CODE=your-code`}
            </pre>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Need help? Check <code className="bg-gray-100 px-2 py-1 rounded text-xs">CLOUDFLARE_FIX.md</code> in your project
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

