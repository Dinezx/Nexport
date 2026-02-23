/**
 * Centralized error handling and formatting for the application
 */

export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  CONFLICT = 'CONFLICT_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  SERVER = 'SERVER_ERROR',
  AI_SERVICE = 'AI_SERVICE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export interface AppError {
  type: ErrorType;
  message: string;
  userMessage: string; // User-friendly message
  code?: string | number;
  details?: Record<string, any>;
  statusCode?: number;
}

/**
 * Parse any error into a standardized AppError
 */
export function parseError(error: unknown): AppError {
  // If already an AppError, return as-is
  if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
    return error as AppError;
  }

  // Handle Supabase errors
  if (error && typeof error === 'object') {
    const err = error as any;
    
    if (err.code === 'PGRST116') {
      return {
        type: ErrorType.NOT_FOUND,
        message: 'Record not found in database',
        userMessage: 'The requested item was not found.',
        code: err.code,
        statusCode: 404,
      };
    }

    if (err.code === '23505') {
      return {
        type: ErrorType.CONFLICT,
        message: 'Duplicate entry',
        userMessage: 'This item already exists.',
        code: err.code,
        statusCode: 409,
      };
    }

    if (err.message?.includes('JWT')) {
      return {
        type: ErrorType.AUTHENTICATION,
        message: 'Invalid JWT token',
        userMessage: 'Your session has expired. Please log in again.',
        statusCode: 401,
      };
    }

    if (err.message?.includes('permission denied')) {
      return {
        type: ErrorType.AUTHORIZATION,
        message: 'Access denied',
        userMessage: 'You do not have permission to perform this action.',
        statusCode: 403,
      };
    }

    if (err.status === 429) {
      return {
        type: ErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded',
        userMessage: 'Too many requests. Please try again later.',
        statusCode: 429,
      };
    }

    if (err.status >= 500) {
      return {
        type: ErrorType.SERVER,
        message: `Server error: ${err.message}`,
        userMessage: 'Server error. Please try again later.',
        statusCode: err.status,
      };
    }

    // Network errors
    if (err.message?.includes('network') || err.message?.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        message: err.message,
        userMessage: 'Network error. Please check your connection.',
      };
    }

    // AI service errors
    if (err.message?.includes('AI') || err.message?.includes('Hugging Face')) {
      return {
        type: ErrorType.AI_SERVICE,
        message: err.message,
        userMessage: 'AI service temporarily unavailable. Please try again.',
      };
    }
  }

  // Handle vanilla Error objects
  if (error instanceof Error) {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        message: error.message,
        userMessage: 'Network error. Please check your connection.',
      };
    }

    return {
      type: ErrorType.UNKNOWN,
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again.',
    };
  }

  // Handle strings
  if (typeof error === 'string') {
    return {
      type: ErrorType.UNKNOWN,
      message: error,
      userMessage: error,
    };
  }

  // Fallback
  return {
    type: ErrorType.UNKNOWN,
    message: 'An unexpected error occurred',
    userMessage: 'Something went wrong. Please try again.',
  };
}

/**
 * Format error message for logging
 */
export function formatErrorLog(error: AppError): string {
  return `[${error.type}] ${error.message}${error.code ? ` (${error.code})` : ''}`;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: AppError): boolean {
  const retryableTypes = [
    ErrorType.NETWORK,
    ErrorType.RATE_LIMIT,
    ErrorType.SERVER,
  ];
  return retryableTypes.includes(error.type);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const appError = parseError(err);

      if (!isRetryableError(appError)) {
        throw err;
      }

      if (attempt < maxAttempts - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

/**
 * Common validation error factory functions
 */
export const ValidationErrors = {
  required: (field: string): AppError => ({
    type: ErrorType.VALIDATION,
    message: `${field} is required`,
    userMessage: `Please provide ${field}.`,
  }),

  invalid: (field: string, reason?: string): AppError => ({
    type: ErrorType.VALIDATION,
    message: `Invalid ${field}${reason ? `: ${reason}` : ''}`,
    userMessage: `Please check the ${field} format.`,
  }),

  minLength: (field: string, length: number): AppError => ({
    type: ErrorType.VALIDATION,
    message: `${field} must be at least ${length} characters`,
    userMessage: `${field} must be at least ${length} characters long.`,
  }),

  maxLength: (field: string, length: number): AppError => ({
    type: ErrorType.VALIDATION,
    message: `${field} must be at most ${length} characters`,
    userMessage: `${field} cannot exceed ${length} characters.`,
  }),

  range: (field: string, min: number, max: number): AppError => ({
    type: ErrorType.VALIDATION,
    message: `${field} must be between ${min} and ${max}`,
    userMessage: `${field} must be between ${min} and ${max}.`,
  }),
};

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse(json: string): Record<string, any> | null {
  try {
    return JSON.parse(json);
  } catch (err) {
    console.error('JSON parse error:', err);
    return null;
  }
}

/**
 * Execute async function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out',
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs),
  );
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Try-catch wrapper that returns result/error tuple (go-style error handling)
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
): Promise<[data: T | null, error: AppError | null]> {
  try {
    const data = await fn();
    return [data, null];
  } catch (err) {
    return [null, parseError(err)];
  }
}

/**
 * Create a typed error with helper
 */
export function createError(
  type: ErrorType,
  message: string,
  userMessage?: string,
  details?: Record<string, any>,
): AppError {
  return {
    type,
    message,
    userMessage: userMessage || message,
    details,
  };
}
