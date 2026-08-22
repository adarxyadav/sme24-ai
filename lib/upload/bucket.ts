// The uploads bucket and its path rule, shared by the upload route (writes),
// the trigger route (validates ownership) and stage 1 (reads).
export const UPLOADS_BUCKET = "uploads";
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

// <user_id>/<uuid>.pdf — the first folder is the owner, which is what the
// trigger route checks against the session (t-020-spec.md D1).
export function uploadPath(userId: string, objectId: string): string {
  return `${userId}/${objectId}.pdf`;
}

export function ownsUploadPath(userId: string, path: string): boolean {
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(path) && path.startsWith(`${userId}/`);
}

// "%PDF-" — the only check that does not trust the client's content type.
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}
