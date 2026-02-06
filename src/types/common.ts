/**
 * Result type for error handling without exceptions
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Helper to create successful result
 */
export function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * Helper to create error result
 */
export function failure<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}
