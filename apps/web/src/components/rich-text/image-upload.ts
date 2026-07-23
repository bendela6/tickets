// Raw-bytes upload to the attachments API (Task 7). Headers carry mime type
// and URI-encoded filename; the body is the file itself (no multipart).
//
// XMLHttpRequest instead of fetch (design§06 "uploading"): the widget
// decoration's 3px progress bar needs real upload progress, and fetch has no
// upload-progress event — only XHR's `upload.onprogress` does. `onProgress`
// is optional so call sites that don't render progress can ignore it.
export function uploadImage(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ id: number; url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/attachments');
    xhr.setRequestHeader('content-type', file.type);
    xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };
    xhr.onload = () => {
      let body: { id?: number; url?: string; error?: string } = {};
      try {
        body = xhr.responseText ? (JSON.parse(xhr.responseText) as typeof body) : {};
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as { id: number; url: string });
      } else {
        reject(new Error(body.error ?? `upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('upload failed (network error)'));
    xhr.send(file);
  });
}
