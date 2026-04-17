/**
 * Response envelope helpers.
 *
 * Existing clients read top-level fields on each endpoint (e.g. `npcs`,
 * `queue`, `archive`), so we keep those as-is and add a consistent
 * `success` boolean and, on failures, a uniform `error` / `message`
 * shape. This is a non-breaking change: old consumers still see their
 * original fields, new consumers get a predictable envelope.
 */

/**
 * Send a success response. Any extra fields on `data` are spread onto the
 * top level of the body.
 */
export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

/**
 * Send a failure response with a consistent error envelope.
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} error - short error label (e.g. 'Not found')
 * @param {string} [message] - optional human-readable detail
 * @param {object} [extra] - optional additional fields
 */
export function fail(res, status, error, message, extra = {}) {
  const body = { success: false, error, ...extra };
  if (message) body.message = message;
  return res.status(status).json(body);
}

export default { ok, fail };
