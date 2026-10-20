import { describe, expect, it } from "vitest";
import { readCache, writeCache } from "./view-cache";

function memoryStore(initial: Record<string, unknown> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    get: async (k: string) => map.get(k),
    set: async (k: string, v: unknown) => void map.set(k, v),
    clear: async () => map.clear(),
  };
}

describe("readCache", () => {
  it("returns the owner's saved views", async () => {
    const store = memoryStore({ owner: "u1", entries: [1], tax: [2] });
    expect(await readCache("u1", ["entries", "tax", "emails"], store)).toEqual({ entries: [1], tax: [2] });
  });

  it("wipes another user's data and claims the cache", async () => {
    const store = memoryStore({ owner: "u1", entries: ["secret"] });
    expect(await readCache("u2", ["entries"], store)).toEqual({});
    expect(Object.fromEntries(store.map)).toEqual({ owner: "u2" });
  });

  it("treats an unowned cache as foreign", async () => {
    const store = memoryStore({ entries: ["stray"] });
    expect(await readCache("u1", ["entries"], store)).toEqual({});
    expect(Object.fromEntries(store.map)).toEqual({ owner: "u1" });
  });

  it("falls back to an empty cache when storage fails", async () => {
    const fail = async () => { throw new Error("no idb"); };
    const broken = { get: fail, set: fail, clear: fail };
    expect(await readCache("u1", ["entries"], broken)).toEqual({});
    await expect(writeCache("entries", [], broken)).resolves.toBeUndefined();
  });
});
