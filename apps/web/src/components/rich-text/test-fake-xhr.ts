// A minimal, fully-controllable XMLHttpRequest stand-in for image-upload's
// tests — jsdom's real XHR can't be told to hold a request open the way the
// old fetch-mock tests deferred resolution (`resolveUpload`), and it can't
// synthesize `upload.onprogress` events either. Install with
// `vi.stubGlobal('XMLHttpRequest', FakeXHR)`, drive instances explicitly via
// `.progress()`/`.respond()`/`.networkError()`, and call `FakeXHR.reset()` in
// afterEach alongside `vi.unstubAllGlobals()`.
export class FakeXHR {
  static instances: FakeXHR[] = [];

  method = '';
  url = '';
  headers: Record<string, string> = {};
  status = 0;
  responseText = '';
  body: unknown;
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeXHR.instances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body: unknown): void {
    this.body = body;
  }

  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  respond(status: number, responseBody: unknown): void {
    this.status = status;
    this.responseText = JSON.stringify(responseBody);
    this.onload?.();
  }

  networkError(): void {
    this.onerror?.();
  }

  static reset(): void {
    FakeXHR.instances = [];
  }

  static last(): FakeXHR {
    const instance = FakeXHR.instances.at(-1);
    if (!instance) {
      throw new Error('FakeXHR: no instances created yet');
    }
    return instance;
  }
}
