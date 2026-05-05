# TTFB vs FCP: Understanding Streaming Performance

## Background

After `perf/initial-load` (PR #6), Speed Insights reported a significant jump in TTFB:

| Metric | Before | After |
|--------|--------|-------|
| TTFB   | 0.28s  | 0.72s |
| FCP    | 3.44s  | 2.02s |
| LCP    | 4.36s  | 2.02s |
| CLS    | —      | 0.01  |

The TTFB increase looked alarming, but FCP and LCP nearly halved. Understanding why requires knowing what Speed Insights is actually measuring.

## What Speed Insights reports as TTFB

Speed Insights captures **total document completion time** — the point when all chunks of the streamed HTML response have been received — not the arrival of the first byte. For a streaming response this is the time the *last* chunk lands, which grows as more data is moved to the server.

This is different from the traditional definition of TTFB (time to receive the first byte of the response body), and it means a higher Speed Insights TTFB after adding server-side data fetching is expected, not a regression.

## Verifying streaming health

To confirm streaming was actually working (and not blocked), a fetch-based chunk observer was run against the production URL:

```js
// stream-observer.mjs
const res = await fetch('https://your-vercel-domain.app/', {
  headers: { 'Accept-Encoding': 'identity' },
})
const reader = res.body.getReader()
const decoder = new TextDecoder()
let i = 0
const start = Date.now()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(`chunk ${i++} (+${Date.now() - start}ms)`)
  console.log(decoder.decode(value).slice(0, 300))
}
```

Results confirmed streaming is healthy:

| Chunk | Content | Time |
|-------|---------|------|
| 0 | Static shell + loading skeleton | ~60ms |
| 1 | Entries data | ~232ms |
| 2 | Sidebar HTML | ~244ms |

If streaming were blocked, there would be a single chunk arriving at ~720ms. Multiple early chunks confirm the static shell and skeleton are flushing immediately, with data following progressively.

## The trade-off

Moving DB queries to the server adds time before the final chunk arrives, which raises the Speed Insights TTFB figure. But the user sees content much earlier — the skeleton arrives at ~60ms and data at ~232ms, versus the previous approach where the browser had to fetch everything client-side after the initial page load.

The FCP/LCP improvement (3.44s/4.36s → 2.02s/2.02s) is the meaningful signal. The TTFB increase is the expected bookkeeping cost of that improvement.

## Key distinction

| Signal | Meaning | Direction after server-side data |
|--------|---------|----------------------------------|
| Speed Insights TTFB | Time until last chunk received | Goes up |
| FCP / LCP | Time until user sees content | Goes down |
| Chrome DevTools TTFB | Time to first byte (true TTFB) | Stays low (~60ms) |

When evaluating streaming changes, prefer FCP/LCP as the user-facing signal. Use the chunk observer or Chrome DevTools → Network → Timing to verify the stream is not blocked.
