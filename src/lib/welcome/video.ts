// The first-run "why Never Throw In The Towel exists" welcome video (Anthony's
// intro). Shown once as a modal on a new member's first Today screen, and
// revisitable any time from the /welcome page (linked in Settings).
//
// Pure + client-safe (no server-only import) so both the modal and the /welcome
// page share one source of truth for the id/title. The id is the `v=` value from
// the YouTube URL Anthony shared (youtube.com/watch?v=9VeBBTdgx9k).

export const WELCOME_VIDEO_ID = "9VeBBTdgx9k";
export const WELCOME_VIDEO_TITLE = "Why Never Throw In The Towel";
