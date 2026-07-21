import { getClient, initSignals } from './index';

declare global {
  interface Window {
    Signals?: { initSignals: typeof initSignals; getClient: typeof getClient };
  }
}

const dsn = document.currentScript instanceof HTMLScriptElement ? document.currentScript.dataset.dsn : undefined;

if (dsn) {
  initSignals({ dsn });
}

window.Signals = { initSignals, getClient };
