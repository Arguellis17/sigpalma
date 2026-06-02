import { actionError, type ActionFailure } from "@/app/actions/types";

/**
 * Detects PostgreSQL unique-violation (SQLSTATE 23505) or a named constraint in the error message.
 *
 * @param err - PostgREST / Supabase error object
 * @param constraintName - Optional partial index or constraint name to match in message
 */
export function isUniqueViolation(
  err: { code?: string; message?: string } | null | undefined,
  constraintName?: string
): boolean {
  if (err?.code === "23505") return true;
  if (constraintName && err?.message?.includes(constraintName)) return true;
  return false;
}

/**
 * Maps a PostgREST error to a user-facing ActionFailure, with optional unique-constraint message.
 */
export function actionErrorFromPostgrest(
  err: { code?: string; message?: string } | null | undefined,
  fallback: string,
  options?: { uniqueMessage?: string; constraintName?: string }
): ActionFailure {
  if (
    options?.uniqueMessage &&
    isUniqueViolation(err, options.constraintName)
  ) {
    return actionError(options.uniqueMessage);
  }
  return actionError(err?.message ?? fallback);
}
