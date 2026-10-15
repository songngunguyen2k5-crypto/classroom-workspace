import crypto from 'crypto';
import { ENV } from '../config/env.js';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // AES-256 cần khóa 32 bytes
const IV_LENGTH = 16;  // AES-CBC IV = 16 bytes

// Chuẩn hóa khóa bí mật về đúng 32 bytes bằng SHA-256
const getKey = (): Buffer => {
  return crypto.createHash('sha256').update(ENV.ENCRYPTION_KEY).digest();
};

/**
 * Mã hóa chuỗi văn bản (plaintext) → chuỗi hex IV:EncryptedData
 * Dùng để mã hóa Refresh Token trước khi lưu vào database
 */
export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Giải mã chuỗi hex IV:EncryptedData → văn bản gốc
 * Dùng để giải mã Refresh Token khi Backend cần dùng để đổi lấy Access Token
 */
export const decrypt = (encryptedText: string): string => {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Dữ liệu mã hóa không hợp lệ');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted.toString('utf8');
};
