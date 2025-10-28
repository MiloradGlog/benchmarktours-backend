/**
 * Setup Code Utility
 * Generates and validates user setup codes for first-time password setup
 */

import crypto from 'crypto';

/**
 * Generates a random 8-character setup code in format: XXXX-XXXX
 * Uses uppercase alphanumeric characters excluding ambiguous ones (0, O, 1, I, L)
 *
 * @returns Setup code string (e.g., "B7K9-M3XQ")
 */
export function generateSetupCode(): string {
  // Character set excluding ambiguous characters
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const codeLength = 8;

  let code = '';
  const randomBytes = crypto.randomBytes(codeLength);

  for (let i = 0; i < codeLength; i++) {
    code += chars[randomBytes[i] % chars.length];
  }

  // Format as XXXX-XXXX for readability
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Normalizes a setup code for consistent comparison
 * - Converts to uppercase
 * - Removes whitespace and dashes
 * - Adds dash back in standard format
 *
 * @param code - Raw setup code from user input
 * @returns Normalized code (e.g., "b7k9m3xq" -> "B7K9-M3XQ")
 */
export function normalizeSetupCode(code: string): string {
  // Remove all whitespace and dashes, convert to uppercase
  const cleaned = code.replace(/[\s-]/g, '').toUpperCase();

  // Add dash back in standard format
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }

  return cleaned;
}

/**
 * Validates setup code format
 *
 * @param code - Setup code to validate
 * @returns True if format is valid
 */
export function isValidSetupCodeFormat(code: string): boolean {
  const normalized = normalizeSetupCode(code);
  // Check format: 8 uppercase alphanumeric characters with dash in middle
  return /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/.test(normalized);
}

/**
 * Calculates expiration date for setup codes
 * Default: 7 days from now
 *
 * @param daysValid - Number of days the code should be valid (default: 7)
 * @returns Expiration date
 */
export function getSetupCodeExpiration(daysValid: number = 7): Date {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + daysValid);
  return expirationDate;
}
