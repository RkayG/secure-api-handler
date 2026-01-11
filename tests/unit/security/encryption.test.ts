/**
 * Encryption Service Unit Tests
 */

import { EncryptionService } from '../../../src/security/encryption';

describe('EncryptionService', () => {
    let encryptionService: EncryptionService;
    const testKey = 'test-secret-key-1234567890123456'; // 32 bytes

    beforeAll(() => {
        // Set env var for testing if not set
        process.env.ENCRYPTION_KEY = testKey;
        encryptionService = EncryptionService.getInstance();
    });

    describe('Encryption/Decryption', () => {
        it('should encrypt and decrypt string data correctly', async () => {
            const originalData = 'sensitive-data-123';
            const encrypted = await encryptionService.encrypt(originalData);

            expect(encrypted).toBeDefined();
            expect(encrypted).not.toBe(originalData);

            const decrypted = await encryptionService.decrypt(encrypted);
            expect(decrypted).toBe(originalData);
        });

        it('should encrypt and decrypt object data correctly', async () => {
            const originalData = { user: 'admin', role: 'superuser', id: 123 };
            const encrypted = await encryptionService.encrypt(originalData);

            expect(encrypted).toBeDefined();

            const decrypted = await encryptionService.decrypt(encrypted);
            expect(decrypted).toEqual(originalData);
        });

        it('should fail to decrypt with wrong key', async () => {
            const originalData = 'sensitive-data';
            const encrypted = await encryptionService.encrypt(originalData);

            // Decrypt with a different key
            await expect(encryptionService.decrypt(encrypted, { key: 'wrong-key-1234567890123456' }))
                .rejects.toThrow('Decryption failed');
        });
    });

    describe('Hashing', () => {
        it('should hash data securely and verify it', async () => {
            const password = 'my-secure-password';
            const hash = await encryptionService.hash(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash).toContain(':'); // Salt separator

            const isValid = await encryptionService.verifyHash(password, hash);
            expect(isValid).toBe(true);
        });

        it('should return false for invalid password verification', async () => {
            const password = 'my-secure-password';
            const hash = await encryptionService.hash(password);

            const isValid = await encryptionService.verifyHash('wrong-password', hash);
            expect(isValid).toBe(false);
        });
    });

    describe('HMAC', () => {
        it('should create and verify HMAC', () => {
            const data = 'some-message';
            const hmac = encryptionService.createHMAC(data);

            expect(hmac).toBeDefined();

            const isValid = encryptionService.verifyHMAC(data, hmac);
            expect(isValid).toBe(true);
        });

        it('should fail HMAC verification for modified data', () => {
            const data = 'some-message';
            const hmac = encryptionService.createHMAC(data);

            const isValid = encryptionService.verifyHMAC('modified-message', hmac);
            expect(isValid).toBe(false);
        });
    });

    describe('Field Encryption', () => {
        it('should encrypt specified fields in an object', async () => {
            const data = {
                public: 'visible',
                secret: 'hidden',
                nested: { sensitive: 'data' }
            };

            const result = await encryptionService.encryptFields(data, ['secret']);

            expect(result.public).toBe('visible');
            expect(result.secret).not.toBe('hidden');
        });

        it('should encrypt nested fields using dot notation', async () => {
            const data = {
                public: 'visible',
                nested: {
                    sensitive: 'extremely-secret',
                    safe: 'ok'
                }
            };

            const result = await encryptionService.encryptFields(data, ['nested.sensitive']);

            expect(result.public).toBe('visible');
            expect(result.nested.safe).toBe('ok');
            expect(result.nested.sensitive).not.toBe('extremely-secret');

            // decryption check
            const decrypted = await encryptionService.decryptFields(result, ['nested.sensitive']);
            expect(decrypted.nested.sensitive).toBe('extremely-secret');
        });

        it('should decrypt specified fields in an object', async () => {
            const original = { public: 'visible', secret: 'hidden' };
            const encrypted = await encryptionService.encryptFields(original, ['secret']);
            const decrypted = await encryptionService.decryptFields(encrypted, ['secret']);

            expect(decrypted).toEqual(original);
        });
    });
});
