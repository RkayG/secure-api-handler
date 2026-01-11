/**
 * Encryption Service
 *
 * Provides data encryption and decryption for sensitive information
 * using AES-256-GCM encryption with proper key management.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  scrypt,
  createHmac,
  timingSafeEqual
} from 'crypto';
import * as crypto from 'crypto';
import { EncryptionAlgorithm } from '../core/types';

export interface EncryptionOptions {
  algorithm?: EncryptionAlgorithm;
  key?: string;
  keyLength?: number;
  ivLength?: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
  algorithm: EncryptionAlgorithm;
  timestamp: Date;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private algorithm: EncryptionAlgorithm;
  private key: Buffer;
  private keyLength: number;
  private ivLength: number;

  private constructor(options: EncryptionOptions = {}) {
    this.algorithm = options.algorithm || 'AES-256-GCM';
    this.keyLength = options.keyLength || 32; // 256 bits
    this.ivLength = options.ivLength || 16; // 128 bits

    // Use provided key or derive from environment
    if (options.key) {
      this.key = this.deriveKey(options.key);
    } else if (process.env.ENCRYPTION_KEY) {
      this.key = this.deriveKey(process.env.ENCRYPTION_KEY);
    } else {
      throw new Error('Encryption key not provided. Set ENCRYPTION_KEY environment variable or provide key in options.');
    }
  }

  public static getInstance(options?: EncryptionOptions): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService(options);
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  public async encrypt(data: any, options: Partial<EncryptionOptions> = {}): Promise<string> {
    try {
      const jsonData = JSON.stringify(data);
      const iv = randomBytes(this.ivLength);

      const cipher = createCipheriv(
        options.algorithm || this.algorithm,
        options.key ? this.deriveKey(options.key) : this.key,
        iv
      ) as unknown as crypto.CipherGCM;

      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: authTag.toString('hex'),
        algorithm: this.algorithm,
        timestamp: new Date(),
      };

      return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
    } catch (error: any) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data
   */
  public async decrypt(encryptedString: string, options: Partial<EncryptionOptions> = {}): Promise<any> {
    try {
      const encryptedData: EncryptedData = JSON.parse(
        Buffer.from(encryptedString, 'base64').toString('utf8')
      );

      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      const decipher = createDecipheriv(
        options.algorithm || encryptedData.algorithm,
        options.key ? this.deriveKey(options.key) : this.key,
        iv
      ) as unknown as crypto.DecipherGCM;

      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt specific fields in an object (supports dot notation for nested fields)
   */
  public async encryptFields(
    data: Record<string, any>,
    fields: string[],
    options: Partial<EncryptionOptions> = {}
  ): Promise<Record<string, any>> {
    const result = { ...data };

    for (const field of fields) {
      if (field.includes('.')) {
        const value = this.getNestedProperty(result, field);
        if (value !== undefined && value !== null) {
          const encrypted = await this.encrypt(value, options);
          this.setNestedProperty(result, field, encrypted);
        }
      } else if (result[field] !== undefined && result[field] !== null) {
        result[field] = await this.encrypt(result[field], options);
      }
    }

    return result;
  }

  /**
   * Decrypt specific fields in an object (supports dot notation for nested fields)
   */
  public async decryptFields(
    data: Record<string, any>,
    fields: string[],
    options: Partial<EncryptionOptions> = {}
  ): Promise<Record<string, any>> {
    const result = { ...data };

    for (const field of fields) {
      if (field.includes('.')) {
        const value = this.getNestedProperty(result, field);
        if (value !== undefined && value !== null) {
          try {
            const decrypted = await this.decrypt(value, options);
            this.setNestedProperty(result, field, decrypted);
          } catch (error: any) {
            console.warn(`Failed to decrypt field ${field}:`, error.message);
          }
        }
      } else if (result[field] !== undefined && result[field] !== null) {
        try {
          result[field] = await this.decrypt(result[field], options);
        } catch (error: any) {
          console.warn(`Failed to decrypt field ${field}:`, error.message);
        }
      }
    }

    return result;
  }

  /**
   * Helper to get nested property value
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined) ? o[key] : undefined, obj);
  }

  /**
   * Helper to set nested property value
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((o, key) => {
      if (!o[key]) o[key] = {};
      return o[key];
    }, obj);

    if (lastKey && target) {
      target[lastKey] = value;
    }
  }

  /**
   * Process response data - encrypt sensitive fields
   */
  public async processResponse(data: any): Promise<any> {
    // This would be configured based on your needs
    // For now, we'll encrypt fields that contain sensitive keywords
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'credit_card'];

    if (typeof data === 'object' && data !== null) {
      return this.encryptFields(data, sensitiveFields);
    }

    return data;
  }

  /**
   * Process request data - decrypt encrypted fields
   */
  public async processRequest(data: any): Promise<any> {
    const encryptedFields = ['encrypted_data', 'secure_payload'];

    if (typeof data === 'object' && data !== null) {
      return this.decryptFields(data, encryptedFields);
    }

    return data;
  }

  /**
   * Generate a new encryption key
   */
  public static generateKey(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Derive a key from a password using scrypt
   */
  private deriveKey(password: string): Buffer {
    const salt = process.env.ENCRYPTION_SALT || 'default-salt-change-in-production';
    return scryptSync(password, salt, this.keyLength);
  }

  /**
   * Hash data securely using scrypt (async)
   * This provides a secure, slow hashing algorithm suitable for passwords
   */
  public async hash(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = randomBytes(16).toString('hex');
      scrypt(data, salt, 64, (err: Error | null, derivedKey: Buffer) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * Verify hashed data
   */
  public async verifyHash(data: string, hashedData: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = hashedData.split(':');
      if (!salt || !key) {
        return resolve(false);
      }
      scrypt(data, salt, 64, (err: Error | null, derivedKey: Buffer) => {
        if (err) return reject(err);
        resolve(key === derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Create a hash-based message authentication code (HMAC)
   */
  public createHMAC(data: string, key?: string): string {
    const hmacKey = key ? this.deriveKey(key) : this.key;
    const hmac = createHmac('sha256', hmacKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify HMAC
   */
  public verifyHMAC(data: string, hmac: string, key?: string): boolean {
    const calculatedHMAC = this.createHMAC(data, key);
    const calculatedBuffer = Buffer.from(calculatedHMAC, 'hex');
    const providedBuffer = Buffer.from(hmac, 'hex');

    if (calculatedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(calculatedBuffer, providedBuffer);
  }

  /**
   * Generate a secure random token
   */
  public generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Encrypt a file buffer
   */
  public async encryptFile(buffer: Buffer, options: Partial<EncryptionOptions> = {}): Promise<Buffer> {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(
      options.algorithm || this.algorithm,
      options.key ? this.deriveKey(options.key) : this.key,
      iv
    ) as unknown as crypto.CipherGCM;

    const encrypted = Buffer.concat([
      iv,
      cipher.update(buffer),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return encrypted;
  }

  /**
   * Decrypt a file buffer
   */
  public async decryptFile(encryptedBuffer: Buffer, options: Partial<EncryptionOptions> = {}): Promise<Buffer> {
    const iv = encryptedBuffer.subarray(0, this.ivLength);
    const tag = encryptedBuffer.subarray(-16); // GCM tag is 16 bytes
    const data = encryptedBuffer.subarray(this.ivLength, -16);

    const decipher = createDecipheriv(
      options.algorithm || this.algorithm,
      options.key ? this.deriveKey(options.key) : this.key,
      iv
    ) as unknown as crypto.DecipherGCM;

    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
  }

  /**
   * Get encryption metadata
   */
  public getMetadata(): {
    algorithm: EncryptionAlgorithm;
    keyLength: number;
    ivLength: number;
  } {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
    };
  }
}
