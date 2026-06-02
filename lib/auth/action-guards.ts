import { isSuperAdmin, type SessionProfile, type UserRole } from "@/lib/auth/session-profile";
import { actionError, type ActionResult } from "@/app/actions/types";

/**
 * Validates an active profile (and optionally auth user) for server actions.
 *
 * @param session - Result of getSessionProfile()
 * @param options.requireUser - When true, also requires session.user (default false)
 * @returns ActionResult with session on success, or "Sesión no válida." on failure
 */
export function assertActiveSession(
  session: SessionProfile | null,
  options?: { requireUser?: boolean }
): ActionResult<SessionProfile> {
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  if (options?.requireUser && !session.user) {
    return actionError("Sesión no válida.");
  }
  return { success: true, data: session };
}

export type AssertActionRolesOptions = {
  /** Roles allowed when superadminBypass is false, or for non-superadmin users. */
  roles: UserRole[];
  /** When true (default), superadmin skips role check. */
  superadminBypass?: boolean;
  message?: string;
};

/**
 * Validates that the session profile has one of the allowed roles.
 * Superadmin bypasses the check when superadminBypass is true (default).
 */
export function assertActionRoles(
  session: SessionProfile,
  options: AssertActionRolesOptions
): ActionResult<SessionProfile> {
  const {
    roles,
    superadminBypass = true,
    message = "Sin permiso.",
  } = options;

  if (superadminBypass && isSuperAdmin(session.profile)) {
    return { success: true, data: session };
  }

  if (!session.profile?.role || !roles.includes(session.profile.role)) {
    return actionError(message);
  }

  return { success: true, data: session };
}
