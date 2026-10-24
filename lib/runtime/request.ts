/** Next may canonicalize request.url; validate the actual HTTP authority as well. */
export function isLocalRequest(request: Request): boolean {
  const url = new URL(request.url), host = request.headers.get("host")?.toLowerCase();
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host)) return false;
  let authority: URL;
  try { authority = new URL(`${url.protocol}//${host}`); } catch { return false; }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || authority.port !== url.port) return false;
  const origin = request.headers.get("origin");
  return (!origin || origin === authority.origin) && request.headers.get("sec-fetch-site") !== "cross-site";
}
