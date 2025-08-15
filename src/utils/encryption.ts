import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config';
import { TokenType } from './constants';

// Encryption key (should be from environment)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

export class EncryptionUtil {
  // Encrypt sensitive data
  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  // Decrypt sensitive data
  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, config.auth.bcryptRounds);
  }

  // Compare password
  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate random token
  static generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate UUID
  static generateUUID(): string {
    return crypto.randomUUID();
  }

  // Hash data with salt
  static hashWithSalt(data: string, salt?: string): { hash: string; salt: string } {
    const saltToUse = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, saltToUse, 10000, 64, 'sha512').toString('hex');
    
    return { hash, salt: saltToUse };
  }

  // Verify hashed data
  static verifyHash(data: string, hash: string, salt: string): boolean {
    const hashToVerify = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
    return hash === hashToVerify;
  }
}

export class JWTUtil {
  // Generate access token
  static generateAccessToken(payload: object): string {
    return jwt.sign(
      { ...payload, type: 'access' },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions
    );
  }

  // Generate refresh token
  static generateRefreshToken(payload: object): string {
    return jwt.sign(
      { ...payload, type: 'refresh' },
      config.auth.jwtRefreshSecret,
      { expiresIn: config.auth.jwtRefreshExpiresIn } as jwt.SignOptions
    );
  }

  // Generate custom token (for email verification, password reset, etc.)
  static generateCustomToken(payload: object, type: TokenType, expiresIn: string = '1h'): string {
    return jwt.sign(
      { ...payload, type },
      config.auth.jwtSecret,
      { expiresIn } as jwt.SignOptions
    );
  }

  // Verify access token
  static verifyAccessToken(token: string): any {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): any {
    try {
      const decoded = jwt.verify(token, config.auth.jwtRefreshSecret) as any;
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Verify custom token
  static verifyCustomToken(token: string, expectedType: TokenType): any {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
      if (decoded.type !== expectedType) {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Decode token without verification (for debugging)
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  // Get token expiry
  static getTokenExpiry(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Check if token is expired
  static isTokenExpired(token: string): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    return expiry < new Date();
  }
}

export class SecurityUtil {
  // Generate secure random string
  static generateSecureRandom(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      result += charset[randomIndex];
    }
    
    return result;
  }

  // Generate OTP
  static generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      otp += digits[randomIndex];
    }
    
    return otp;
  }

  // Mask sensitive data
  static maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 2) + '*'.repeat(Math.max(0, localPart.length - 2))
      : localPart;
    return `${maskedLocal}@${domain}`;
  }

  static maskPhone(phone: string): string {
    return phone.substring(0, 2) + '*'.repeat(phone.length - 4) + phone.substring(phone.length - 2);
  }

  static maskPAN(pan: string): string {
    return pan.substring(0, 3) + '*'.repeat(4) + pan.substring(7);
  }

  static maskAadhar(aadhar: string): string {
    return '*'.repeat(8) + aadhar.substring(8);
  }

  // Sanitize filename
  static sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
  }

  // Generate file hash
  static generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Validate CSRF token
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static validateCSRFToken(token: string, expectedToken: string): boolean {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  }
}

export default {
  EncryptionUtil,
  JWTUtil,
  SecurityUtil,
}; 