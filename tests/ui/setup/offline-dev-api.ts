/**
 * UI tests never reach a dev server (#324): every `/api/` request answers 503 at once, so the
 * services take their offline `localStorage` fallback and no request is in flight at teardown.
 * A test that stubs `fetch` itself still overrides this.
 */
const originalFetch = globalThis.fetch;

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (url.pathname.startsWith('/api/')) {
    return Promise.resolve(new Response(null, { status: 503 }));
  }
  return originalFetch(input, init);
};
