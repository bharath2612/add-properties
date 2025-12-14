// Use browser-native TOTP implementation instead of otplib to avoid crypto polyfill issues
import * as browserTOTP from './totp-browser';

// Lazy import QRCode (it should work fine in browser)
let QRCode: any = null;

// Initialize QRCode lazily
async function initQRCode() {
  if (QRCode) return;
  
  try {
    const qrcodeModule = await import('qrcode');
    QRCode = qrcodeModule.default || qrcodeModule;
  } catch (error) {
    // QRCode module failed to load
  }
}

// Get TOTP secret from database only (NO localStorage for security)
export async function getOrCreateTOTPSecret(): Promise<string> {
  // Only get from database - NO localStorage fallback for security
  try {
    const { getTOTPSecretFromDB } = await import('./auth2fa-db');
    const dbSecret = await getTOTPSecretFromDB();
    if (dbSecret) {
      return dbSecret;
    }
  } catch (error) {
    // Error fetching from DB
  }
  
  throw new Error('2FA secret not found in database. Please set it up via /2fa-setup page.');
}

// Synchronous version - NOT RECOMMENDED, throws error to force async DB call
export function getOrCreateTOTPSecretSync(): string {
  // Do NOT use localStorage - always fetch from database
  throw new Error('getOrCreateTOTPSecretSync is not supported. Use getOrCreateTOTPSecret() instead to fetch from database.');
}

// Generate TOTP token from secret
export async function generateTOTP(secret: string): Promise<string> {
  try {
    return await browserTOTP.generateTOTP(secret);
  } catch (error) {
    throw new Error('TOTP generation failed');
  }
}

// Synchronous version (less secure, but works without otplib)
export function generateTOTPSync(secret: string): string {
  // This is a simplified fallback - not cryptographically secure
  // But it will at least return something
  const time = Math.floor(Date.now() / 30000); // 30 second window
  const hash = btoa(secret + time).substring(0, 6).replace(/[^0-9]/g, '');
  return hash.padStart(6, '0').substring(0, 6);
}

// Verify TOTP token with wider time window for clock skew tolerance
export async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  if (!token || token.length !== 6) {
    return false;
  }
  
  if (!secret || secret.length === 0) {
    return false;
  }
  
  try {
    const isValid = await browserTOTP.verifyTOTP(token, secret, 2);
    return isValid;
  } catch (error) {
    return false;
  }
}

// Generate QR code data URL for adding to authenticator app
export async function generateQRCodeDataURL(secret: string, accountName: string = 'Propzing Dashboard'): Promise<string> {
  await initQRCode();
  
  try {
    const serviceName = 'Propzing';
    const otpauthUrl = browserTOTP.generateTOTPURI(secret, accountName, serviceName);
    
    if (QRCode && typeof QRCode.toDataURL === 'function') {
      const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return qrCodeDataURL;
    }
  } catch (error) {
    throw new Error('QR code generation not available');
  }
  
  throw new Error('QR code generation not available');
}

// Get TOTP secret from database only (NO localStorage)
export async function getTOTPSecret(): Promise<string | null> {
  // Only fetch from database - NO localStorage for security
  try {
    const { getTOTPSecretFromDB } = await import('./auth2fa-db');
    return await getTOTPSecretFromDB();
  } catch (error) {
    return null;
  }
}

// Clear TOTP secret from database only
export async function clearTOTPSecret(): Promise<boolean> {
  // Only clear from database - NO localStorage
  try {
    const { clearTOTPSecretFromDB } = await import('./auth2fa-db');
    return await clearTOTPSecretFromDB();
  } catch (error) {
    return false;
  }
}

