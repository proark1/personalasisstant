/**
 * Wraps a promise with a timeout to prevent infinite loading states.
 * If the promise doesn't resolve within the timeout, it rejects with a TimeoutError.
 */
export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 12000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Retry helper with exponential backoff for transient network errors.
 * Only retries on network-related errors, not on business logic errors.
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    timeoutMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, timeoutMs = 12000, onRetry } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (error: any) {
      lastError = error;
      
      // Only retry on network/timeout errors, not on business logic errors
      const isRetryable = 
        error instanceof TimeoutError ||
        (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('network');
      
      if (!isRetryable || attempt > maxRetries) {
        throw error;
      }
      
      onRetry?.(attempt, error);
      
      // Exponential backoff: 300ms, 600ms, 1200ms...
      await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
    }
  }
  
  throw lastError;
}
