const BUCKET = 'documents';

/** Minimal read-only storage client for the worker (Stage 3 §7). */
export async function downloadObject(storageKey: string): Promise<Buffer> {
  const response = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${storageKey}`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!response.ok) {
    throw new Error(`Storage download failed (${response.status}) for ${storageKey}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
