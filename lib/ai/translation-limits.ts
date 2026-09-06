/**
 * Limits shared by the server and the browser.
 *
 * Deliberately free of `server-only` so the input counter and the API
 * validation enforce the same number from one definition — a client-side limit
 * that disagreed with the server's would either block valid text or promise a
 * request that then fails.
 *
 * 2000 is the per-request ceiling for Sarvam's `sarvam-translate:v1` model.
 */
export const MAX_INPUT_CHARS = 2000;
