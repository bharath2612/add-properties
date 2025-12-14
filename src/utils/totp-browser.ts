/**
 * Browser-compatible TOTP implementation using Web Crypto API
 * This avoids dependency on Node.js crypto polyfills
 */

// Base32 decoding (RFC 4648)
function base32Decode(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const output: number[] = [];
  
  // Remove padding and convert to uppercase
  base32 = base32.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  
  for (let i = 0; i < base32.length; i++) {
    const char = base32[i];
    const charIndex = alphabet.indexOf(char);
    
    if (charIndex === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    
    value = (value << 5) | charIndex;
    bits += 5;
    
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  
  return new Uint8Array(output);
}

// HMAC-SHA1 using Web Crypto API
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  // Create new ArrayBuffers to avoid SharedArrayBuffer issues
  const keyBuffer = new Uint8Array(key).buffer;
  const messageBuffer = new Uint8Array(message).buffer;
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
  return new Uint8Array(signature);
}

// Dynamic truncation
function dynamicTruncate(hash: Uint8Array): number {
  const offset = hash[hash.length - 1] & 0xf;
  return (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
}

// Generate TOTP token (RFC 6238)
export async function generateTOTP(secret: string, step: number = 30): Promise<string> {
  try {
    // Decode secret from base32
    const key = base32Decode(secret);
    
    if (key.length === 0) {
      throw new Error('Invalid secret: decoded key is empty');
    }
    
    // Calculate time step (counter)
    const unixTime = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(unixTime / step);
    
    // Convert time step to 8-byte buffer (big-endian, 64-bit unsigned integer)
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    // Set as 64-bit big-endian: upper 32 bits are 0 for reasonable time values
    timeView.setUint32(0, 0, false); // Big-endian: upper 32 bits
    timeView.setUint32(4, timeStep, false); // Big-endian: lower 32 bits
    
    // Generate HMAC-SHA1
    const timeArray = new Uint8Array(timeBuffer);
    const hmac = await hmacSha1(key, timeArray);
    
    if (hmac.length < 20) {
      throw new Error('HMAC output too short');
    }
    
    // Dynamic truncation (RFC 4226)
    const code = dynamicTruncate(hmac);
    
    // Return as 6-digit string
    const token = code.toString().padStart(6, '0');
    
    return token;
  } catch (error) {
    throw error;
  }
}

// Verify TOTP token with window tolerance
export async function verifyTOTP(token: string, secret: string, window: number = 2, step: number = 30): Promise<boolean> {
  const trimmedToken = token.trim();
  if (trimmedToken.length !== 6) {
    return false;
  }
  
  // Try current time step and ±window steps
  for (let i = -window; i <= window; i++) {
    try {
      // Calculate time step with offset
      const timeStep = Math.floor(Date.now() / 1000 / step) + i;
      
      // Decode secret
      const key = base32Decode(secret);
      
      // Convert time step to 8-byte buffer (big-endian, 64-bit)
      const timeBuffer = new ArrayBuffer(8);
      const timeView = new DataView(timeBuffer);
      timeView.setUint32(0, 0, false); // Upper 32 bits
      timeView.setUint32(4, timeStep, false); // Lower 32 bits (big-endian)
      
      // Generate HMAC-SHA1
      const timeArray = new Uint8Array(timeBuffer);
      const hmac = await hmacSha1(key, timeArray);
      
      // Dynamic truncation
      const code = dynamicTruncate(hmac);
      const expectedToken = code.toString().padStart(6, '0');
      
      if (expectedToken === trimmedToken) {
        return true;
      }
    } catch (error) {
      // Continue to next offset on error
    }
  }
  
  
  return false;
}

// Generate a random base32 secret
export function generateSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return secret;
}

// Generate TOTP auth URI for QR codes
export function generateTOTPURI(secret: string, accountName: string, issuer: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

