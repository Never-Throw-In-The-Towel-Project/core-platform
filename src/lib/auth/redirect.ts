/**
 * `next` (where to send someone after login) is carried through a query
 * param and a hidden form field, both outside this app's control once
 * they're on the wire -- only a same-origin relative path is ever honoured.
 * Shared by the login form action and /auth/callback so both sides of the
 * post-login redirect agree on what's safe.
 */
export function isSafeRedirectPath(path: string): boolean {
  // Must be an absolute-path reference to THIS origin. The backslash check is
  // load-bearing: browsers (and the WHATWG URL parser) fold `\` -> `/` in
  // http(s) URLs, so `/\evil.com` -- which passes the `//` and `://` checks --
  // resolves to the protocol-relative `//evil.com` -> `https://evil.com`. Since
  // signInWithPassword()/signUp() pass a validated `next` straight to
  // redirect() without origin-prefixing, that was a real open redirect: a
  // victim signs in on the genuine site with their real password and is then
  // bounced to an attacker host. Reject any backslash to close it.
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !path.includes("://")
  );
}
