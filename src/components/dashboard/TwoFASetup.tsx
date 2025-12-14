import React, { useState, useEffect } from 'react';
import { getOrCreateTOTPSecret, generateQRCodeDataURL, clearTOTPSecret } from '../../utils/auth2fa';
import * as browserTOTP from '../../utils/totp-browser';
import { useToast } from '../common/Toast';

const TwoFASetup: React.FC = () => {
  const [secret, setSecret] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSecret().catch(() => {
        error('Failed to load 2FA setup. Please refresh the page.');
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const loadSecret = async () => {
    try {
      // Only get from database - NO localStorage for security
      const existingSecret = await getOrCreateTOTPSecret();
      
      if (!existingSecret) {
        error('2FA secret not found in database. Please contact administrator.');
        return;
      }
      
      setSecret(existingSecret);
      
      try {
        const qrUrl = await generateQRCodeDataURL(existingSecret);
        setQrCodeUrl(qrUrl);
      } catch (err: any) {
        // QR code generation failed, but secret key is still available
      }
    } catch (err: any) {
      error(`Failed to load 2FA secret: ${err.message || 'Unknown error'}. Please refresh the page.`);
    }
  };

  const handleCopySecret = async () => {
    if (!secret) return;
    
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      success('Secret copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      error('Failed to copy secret');
    }
  };

  const handleResetSecret = async () => {
    if (confirm('Are you sure you want to reset the 2FA secret? All team members will need to re-add it to their authenticator apps.')) {
      try {
        // Clear from database only (NO localStorage)
        await clearTOTPSecret();
        
        // Generate and save new secret to database
        const newSecret = browserTOTP.generateSecret();
        const { saveTOTPSecretToDB } = await import('../../utils/auth2fa-db');
        const saved = await saveTOTPSecretToDB(newSecret);
        
        if (saved) {
          await loadSecret();
          success('2FA secret has been reset and saved to database');
        } else {
          error('Failed to save new secret to database');
        }
      } catch (err: any) {
        error(`Failed to reset secret: ${err.message || 'Unknown error'}`);
      }
    }
  };

  if (!secret) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Loading 2FA Setup...</h2>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">Please wait while we generate your 2FA secret.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white mb-2">2FA Setup</h1>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Generate a secret and share it with your team to enable two-factor authentication
        </p>
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>Important:</strong> After adding the secret to your authenticator app, go to the <strong>login page</strong> to enter the 6-digit code.
          </p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-6 space-y-6">
        {/* Secret Display */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
            Secret Key
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={secret}
              readOnly
              className="flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded-lg text-black dark:text-white font-mono text-sm"
            />
            <button
              onClick={handleCopySecret}
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors text-sm"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
            Share this secret with your team members. They need to enter it in their authenticator app.
          </p>
        </div>

        {/* QR Code */}
        {qrCodeUrl && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              QR Code (Alternative Method)
            </label>
            <div className="bg-white dark:bg-black p-4 rounded-lg border border-gray-300 dark:border-zinc-800 inline-block">
              <img src={qrCodeUrl} alt="QR Code for 2FA" className="w-64 h-64" />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
              Team members can scan this QR code with their authenticator app instead of manually entering the secret.
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="border-t border-gray-200 dark:border-zinc-800 pt-6">
          <h3 className="text-sm font-semibold text-black dark:text-white mb-3">Setup Instructions</h3>
          <ol className="space-y-2 text-sm text-gray-700 dark:text-zinc-300 list-decimal list-inside">
            <li>Copy the secret key above or scan the QR code</li>
            <li>Open your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)</li>
            <li>Add a new account and enter the secret or scan the QR code</li>
            <li>The app will generate a 6-digit code that changes every 30 seconds</li>
            <li><strong>Go back to the login page</strong> (click "Need to set up 2FA? Click here" link or go to the root URL)</li>
            <li><strong>Enter the 6-digit code</strong> from your authenticator app in the login page input field</li>
            <li>Click "Access Dashboard" to login</li>
          </ol>
        </div>

        {/* Reset Button */}
        <div className="border-t border-gray-200 dark:border-zinc-800 pt-6">
          <button
            onClick={handleResetSecret}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Reset 2FA Secret
          </button>
          <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
            <strong>Warning:</strong> Resetting will require all team members to re-add the secret to their authenticator apps.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TwoFASetup;

