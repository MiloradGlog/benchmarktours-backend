import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parseISO, isValid } from 'date-fns';

// Japan Standard Time timezone
export const JST_TIMEZONE = 'Asia/Tokyo';

/**
 * Get current date/time in UTC (for database operations and comparisons)
 */
export const nowUTC = (): Date => {
  return new Date();
};

/**
 * Parse an ISO string to a Date object (assumes UTC if no timezone specified)
 */
export const parseUTC = (dateString: string): Date => {
  const date = parseISO(dateString);
  if (!isValid(date)) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return date;
};

/**
 * Convert a Date object to ISO string (always in UTC)
 * Use this when sending dates to the frontend or storing in database
 */
export const toUTCString = (date: Date): string => {
  return date.toISOString();
};

/**
 * Format a date in JST for logging/debugging purposes
 * @param date - Date object (in UTC)
 * @param format - Format string (default: 'yyyy-MM-dd HH:mm:ss zzz')
 */
export const formatJST = (date: Date, format: string = 'yyyy-MM-dd HH:mm:ss zzz'): string => {
  return formatInTimeZone(date, JST_TIMEZONE, format);
};

/**
 * Convert a date string from JST to UTC Date object
 * Use this when receiving JST input that needs to be stored as UTC
 * @param jstDateString - Date string in JST (e.g., '2024-03-15 14:30:00')
 */
export const jstToUTC = (jstDateString: string): Date => {
  const date = parseISO(jstDateString);
  if (!isValid(date)) {
    throw new Error(`Invalid JST date string: ${jstDateString}`);
  }
  // Treat the input as JST and convert to UTC
  return fromZonedTime(date, JST_TIMEZONE);
};

/**
 * Convert a UTC date to JST Date object
 * @param utcDate - Date object in UTC
 */
export const utcToJST = (utcDate: Date): Date => {
  return toZonedTime(utcDate, JST_TIMEZONE);
};

/**
 * Check if a date is within a range (all dates in UTC)
 */
export const isWithinRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  return date >= startDate && date <= endDate;
};

/**
 * Compare if date1 is before date2 (both in UTC)
 */
export const isBefore = (date1: Date, date2: Date): boolean => {
  return date1 < date2;
};

/**
 * Compare if date1 is after date2 (both in UTC)
 */
export const isAfter = (date1: Date, date2: Date): boolean => {
  return date1 > date2;
};
