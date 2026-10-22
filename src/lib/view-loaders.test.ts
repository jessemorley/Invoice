// Phase 1: views read straight from Supabase with the user's own session
// (RLS applies), scoped to that user. Phase 3: a session that is gone for
// good is told apart from being offline.
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; method: string; args: unknown[] };

const { client } = vi.hoisted(() => ({
  client: {
    calls: [] as Call[],
    session: { data: { session: null as unknown }, error: null as unknown },
  },
}));

// A chainable stand-in for the PostgREST builder: records every call and
// resolves to an empty result.
function builder(table: string) {
  const b: object = new Proxy({}, {
    get(_, method: string) {
      if (method === "then") return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
      return (...args: unknown[]) => {
        client.calls.push({ table, method, args });
        return b;
      };
    },
  });
  return b;
}

vi.mock("./supabase", () => ({
  createBrowserSupabase: () => ({
    auth: { getSession: async () => client.session },
    from: (table: string) => {
      client.calls.push({ table, method: "from", args: [] });
      return builder(table);
    },
  }),
}));

import * as loaders from "./view-loaders";
import { SignedOutError } from "./view-loaders";

const USER = "user-123";
const signedIn = () => (client.session = { data: { session: { user: { id: USER } } }, error: null });

beforeEach(() => {
  client.calls = [];
  signedIn();
});

const LOADERS = {
  loadEntriesViewData: ["entries", "clients", "client_workflow_rates"],
  loadDashboardViewData: ["entries", "invoice_line_items", "invoices"],
  loadInvoicesViewData: ["invoices", "entries", "clients", "user_preferences"],
  loadClientsViewData: ["clients"],
  loadExpensesViewData: ["expenses"],
  loadEmailsViewData: ["scheduled_emails"],
  loadTaxViewData: ["invoices", "expenses", "payg_instalments", "wfh_hours", "entries"],
  loadSettingsViewData: ["business_details", "invoice_sequence", "user_preferences"],
} as const;

describe("view loaders", () => {
  for (const [name, tables] of Object.entries(LOADERS)) {
    it(`${name} reads ${tables.join(", ")} for the signed-in user`, async () => {
      await (loaders[name as keyof typeof LOADERS] as () => Promise<unknown>)();
      const queried = new Set(client.calls.filter((c) => c.method === "from").map((c) => c.table));
      expect([...queried].sort()).toEqual([...new Set(tables)].sort());
      // Every table that has a user_id column is scoped to this user (RLS
      // enforces it anyway). client_workflow_rates has none; RLS scopes it.
      for (const table of queried) {
        if (table === "client_workflow_rates") continue;
        const scopes = client.calls.filter((c) => c.table === table && c.method === "eq" && c.args[0] === "user_id");
        expect(scopes.length, table).toBeGreaterThan(0);
        expect(scopes.every((c) => c.args[1] === USER), table).toBe(true);
      }
    });
  }
});

describe("session handling", () => {
  it("throws SignedOutError when there is no session at all", async () => {
    client.session = { data: { session: null }, error: null };
    await expect(loaders.loadClientsViewData()).rejects.toBeInstanceOf(SignedOutError);
    expect(client.calls).toEqual([]);
  });

  it("throws SignedOutError when the refresh token was rejected", async () => {
    client.session = { data: { session: null }, error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found") };
    await expect(loaders.loadClientsViewData()).rejects.toBeInstanceOf(SignedOutError);
  });

  it("does not treat being offline as signed out", async () => {
    const offline = new AuthRetryableFetchError("Failed to fetch", 0);
    client.session = { data: { session: null }, error: offline };
    const err = await loaders.loadClientsViewData().catch((e) => e);
    expect(err).toBe(offline);
    expect(err).not.toBeInstanceOf(SignedOutError);
  });
});
