import "@testing-library/jest-dom";

// jsdom doesn't implement matchMedia; use-mobile.ts (and anything via AdaptiveSheet) needs it.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

// jsdom has no IntersectionObserver; animate-ui's AnimateIcon (via motion's useInView) needs it.
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;
