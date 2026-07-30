/**
 * `next` (where to send someone after login) is carried through a query
 * param and a hidden form field, both outside this app's control once
 * they're on the wire -- only a same-origin relative path is ever honoured.
 * Shared by the login form action and /auth/callback so both sides of the
 * post-login redirect agree on what's safe.
 */
export function isSafeRedirectPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}
