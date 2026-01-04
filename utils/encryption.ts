/**
 * Encryption utilities for securing sensitive data in IndexedDB
 * Uses Web Crypto API for AES-GCM encryption
 */

// Generate a cryptographic key from a password
export const generateKey = async (password: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('dogechain-bubblemaps-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt data using AES-GCM
export const encryptData = async (data: string, key: CryptoKey): Promise<string> => {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encoder.encode(data)
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
};

// Decrypt data using AES-GCM
export const decryptData = async (encryptedData: string, key: CryptoKey): Promise<string> => {
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encrypted
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
};

// Generate a secure random key for session-based encryption
export const generateSessionKey = async (): Promise<{ key: CryptoKey; password: string }> => {
  const password = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const key = await generateKey(password);

  return { key, password };
};

// Hash wallet address for indexing without storing the actual address
export const hashWalletAddress = async (address: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(address.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// Mask wallet address for display purposes
export const maskWalletAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * EncryptionService class for managing encryption keys and operations
 */
export class EncryptionService {
  private key: CryptoKey | null = null;
  private password: string | null = null;

  // Initialize with a password (should be user-specific)
  async initialize(password?: string): Promise<void> {
    if (!password) {
      // Generate a session-based password
      const session = await generateSessionKey();
      this.password = session.password;
      this.key = session.key;
    } else {
      this.password = password;
      this.key = await generateKey(password);
    }
  }

  // Encrypt an object
  async encryptObject<T>(data: T): Promise<string> {
    if (!this.key) {
      throw new Error('EncryptionService not initialized');
    }
    const json = JSON.stringify(data);
    return encryptData(json, this.key);
  }

  // Decrypt an object
  async decryptObject<T>(encryptedData: string): Promise<T> {
    if (!this.key) {
      throw new Error('EncryptionService not initialized');
    }
    const json = await decryptData(encryptedData, this.key);
    return JSON.parse(json) as T;
  }

  // Check if service is initialized
  isReady(): boolean {
    return this.key !== null;
  }

  // Get the password (for storing in session storage if needed)
  getPassword(): string | null {
    return this.password;
  }
}

// Singleton instance
let encryptionService: EncryptionService | null = null;

export const getEncryptionService = async (): Promise<EncryptionService> => {
  if (!encryptionService) {
    encryptionService = new EncryptionService();
    await encryptionService.initialize();
  }
  return encryptionService;
};

/**
 * Helper function to determine if data should be encrypted
 * Sensitive fields that should always be encrypted
 */
export const shouldEncryptField = (fieldName: string): boolean => {
  const sensitiveFields = [
    'walletAddress',
    'address',
    'privateKey',
    'mnemonic',
    'seed',
    'password',
    'apiKey',
    'secret',
    'token',
  ];

  return sensitiveFields.some((field) =>
    fieldName.toLowerCase().includes(field.toLowerCase())
  );
};
