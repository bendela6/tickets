// Raw-bytes upload to the attachments API (Task 7). Headers carry mime type
// and URI-encoded filename; the body is the file itself (no multipart).
export async function uploadImage(file: File): Promise<{ id: number; url: string }> {
  const response = await fetch('/api/attachments', {
    method: 'POST',
    headers: { 'content-type': file.type, 'x-filename': encodeURIComponent(file.name) },
    body: file,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `upload failed (${response.status})`);
  }
  return (await response.json()) as { id: number; url: string };
}
