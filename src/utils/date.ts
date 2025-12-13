/**
 * Date Utilities
 * 
 * Provides date manipulation and formatting functions
 */

export class DateUtils {
  /**
   * Get current timestamp in milliseconds
   */
  public static now(): number {
    return Date.now();
  }

  /**
   * Get current date
   */
  public static getCurrentDate(): Date {
    return new Date();
  }

  /**
   * Format date to ISO string
   */
  public static toISO(date: Date): string {
    return date.toISOString();
  }

  /**
   * Parse ISO string to date
   */
  public static fromISO(isoString: string): Date {
    return new Date(isoString);
  }

  /**
   * Format date to custom format
   */
  public static format(date: Date, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('SSS', milliseconds);
  }

  /**
   * Add days to date
   */
  public static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add hours to date
   */
  public static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * Add minutes to date
   */
  public static addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  /**
   * Add seconds to date
   */
  public static addSeconds(date: Date, seconds: number): Date {
    const result = new Date(date);
    result.setSeconds(result.getSeconds() + seconds);
    return result;
  }

  /**
   * Subtract days from date
   */
  public static subtractDays(date: Date, days: number): Date {
    return this.addDays(date, -days);
  }

  /**
   * Get difference between dates in milliseconds
   */
  public static diff(date1: Date, date2: Date): number {
    return date1.getTime() - date2.getTime();
  }

  /**
   * Get difference between dates in days
   */
  public static diffInDays(date1: Date, date2: Date): number {
    return Math.floor(this.diff(date1, date2) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get difference between dates in hours
   */
  public static diffInHours(date1: Date, date2: Date): number {
    return Math.floor(this.diff(date1, date2) / (1000 * 60 * 60));
  }

  /**
   * Get difference between dates in minutes
   */
  public static diffInMinutes(date1: Date, date2: Date): number {
    return Math.floor(this.diff(date1, date2) / (1000 * 60));
  }

  /**
   * Get difference between dates in seconds
   */
  public static diffInSeconds(date1: Date, date2: Date): number {
    return Math.floor(this.diff(date1, date2) / 1000);
  }

  /**
   * Check if date is in the past
   */
  public static isPast(date: Date): boolean {
    return date.getTime() < Date.now();
  }

  /**
   * Check if date is in the future
   */
  public static isFuture(date: Date): boolean {
    return date.getTime() > Date.now();
  }

  /**
   * Check if date is today
   */
  public static isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  /**
   * Check if date is yesterday
   */
  public static isYesterday(date: Date): boolean {
    const yesterday = this.subtractDays(new Date(), 1);
    return (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    );
  }

  /**
   * Check if date is tomorrow
   */
  public static isTomorrow(date: Date): boolean {
    const tomorrow = this.addDays(new Date(), 1);
    return (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    );
  }

  /**
   * Get start of day
   */
  public static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day
   */
  public static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get start of month
   */
  public static startOfMonth(date: Date): Date {
    const result = new Date(date);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of month
   */
  public static endOfMonth(date: Date): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get start of year
   */
  public static startOfYear(date: Date): Date {
    const result = new Date(date);
    result.setMonth(0, 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of year
   */
  public static endOfYear(date: Date): Date {
    const result = new Date(date);
    result.setMonth(11, 31);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Check if date is between two dates
   */
  public static isBetween(date: Date, start: Date, end: Date): boolean {
    const time = date.getTime();
    return time >= start.getTime() && time <= end.getTime();
  }

  /**
   * Get relative time string (e.g., "2 hours ago")
   */
  public static getRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) {
      return 'just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (weeks < 4) {
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (months < 12) {
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  }

  /**
   * Get Unix timestamp (seconds)
   */
  public static toUnix(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Create date from Unix timestamp
   */
  public static fromUnix(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  /**
   * Get day of week (0 = Sunday, 6 = Saturday)
   */
  public static getDayOfWeek(date: Date): number {
    return date.getDay();
  }

  /**
   * Get day name
   */
  public static getDayName(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  /**
   * Get month name
   */
  public static getMonthName(date: Date): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[date.getMonth()];
  }

  /**
   * Check if year is leap year
   */
  public static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  /**
   * Get days in month
   */
  public static getDaysInMonth(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  }

  /**
   * Clone date
   */
  public static clone(date: Date): Date {
    return new Date(date.getTime());
  }

  /**
   * Get age from birthdate
   */
  public static getAge(birthdate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const monthDiff = today.getMonth() - birthdate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get quarter of year (1-4)
   */
  public static getQuarter(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  public static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
