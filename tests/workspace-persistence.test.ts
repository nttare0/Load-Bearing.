import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspace,
  exportWorkspacesText,
  hydrateWorkspaceState,
  readCurrentId,
  readWorkspacesResult,
  writeCurrentId,
  writeWorkspaces,
} from "../lib/workspace";
import { eraseLocal } from "../lib/erase";
import { BYOK_STORAGE } from "../lib/byok";

const KEY = "load-bearing:workspaces";

type StorageStub = {
  getItem: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

function withLocalStorage<T>(storage: StorageStub | undefined, run: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  try {
    return run();
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

function storageReturning(raw: string | null): StorageStub {
  return { getItem: (key) => (key === KEY ? raw : null) };
}

test("workspace storage distinguishes an empty key from invalid or unavailable storage", () => {
  assert.deepEqual(
    withLocalStorage(storageReturning(null), () => readWorkspacesResult()),
    { kind: "empty" }
  );

  assert.deepEqual(
    withLocalStorage(undefined, () => readWorkspacesResult()),
    { kind: "unavailable" }
  );

  assert.deepEqual(
    withLocalStorage(
      { getItem: () => { throw new Error("storage denied"); } },
      () => readWorkspacesResult()
    ),
    { kind: "unavailable" }
  );
});

test("a throwing localStorage accessor is reported as unavailable", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("storage blocked");
    },
  });
  try {
    assert.deepEqual(readWorkspacesResult(), { kind: "unavailable" });
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("workspace storage returns valid records with resources and archive metadata intact", () => {
  const workspace = {
    ...createWorkspace("Kigali kitchen"),
    archivedAt: "2026-11-10T12:00:00.000Z",
    messages: [{ id: "m1", role: "user" as const, text: "Analyze this plan", at: "2026-11-10T12:01:00.000Z" }],
    plans: [{ id: "p1", text: "Build a kitchen", at: "2026-11-10T12:01:00.000Z", title: "Build a kitchen" }],
    folders: [{ id: "f1", name: "Research", parentId: null, createdAt: "2026-11-10T12:02:00.000Z", origin: "you" as const }],
    resources: [{ id: "r1", kind: "file" as const, title: "Menu", body: "Draft menu", folderId: "f1", createdAt: "2026-11-10T12:03:00.000Z", origin: "attach" as const }],
  };

  assert.deepEqual(
    withLocalStorage(storageReturning(JSON.stringify([workspace])), () => readWorkspacesResult()),
    { kind: "ok", workspaces: [workspace] }
  );
});

test("workspace storage defaults folders and resources for valid legacy records", () => {
  const current = createWorkspace("Old workspace");
  const { folders: _folders, resources: _resources, ...legacy } = current;

  assert.deepEqual(
    withLocalStorage(storageReturning(JSON.stringify([legacy])), () => readWorkspacesResult()),
    { kind: "ok", workspaces: [{ ...legacy, folders: [], resources: [] }] }
  );
});

test("workspace storage preserves malformed JSON for recovery instead of returning an empty list", () => {
  const raw = "{not valid JSON";

  assert.deepEqual(
    withLocalStorage(storageReturning(raw), () => readWorkspacesResult()),
    { kind: "invalid", raw }
  );
});

test("workspace storage rejects invalid nested records without dropping them", () => {
  const valid = createWorkspace("Valid");
  const invalid = { ...createWorkspace("Invalid"), messages: [{ id: "m1", role: "system", text: "not a supported role", at: "2026-11-10T12:00:00.000Z" }] };
  const raw = JSON.stringify([valid, invalid]);

  assert.deepEqual(
    withLocalStorage(storageReturning(raw), () => readWorkspacesResult()),
    { kind: "invalid", raw }
  );
});

test("a valid empty array is treated as empty workspace storage", () => {
  assert.deepEqual(
    withLocalStorage(storageReturning("[]"), () => readWorkspacesResult()),
    { kind: "empty" }
  );
});

test("empty storage creates one initial workspace that should be persisted", () => {
  const workspace = createWorkspace("Initial chat");
  const state = hydrateWorkspaceState({ kind: "empty" }, null, () => workspace);

  assert.deepEqual(state, {
    workspaces: [workspace],
    currentId: workspace.id,
    persistInitial: true,
    issue: null,
  });
});

test("valid storage preserves records and selects the saved workspace", () => {
  const first = createWorkspace("First");
  const archived = { ...createWorkspace("Archived"), archivedAt: "2026-11-10T12:00:00.000Z" };
  const state = hydrateWorkspaceState({ kind: "ok", workspaces: [first, archived] }, archived.id, () => {
    throw new Error("must not create a new workspace");
  });

  assert.deepEqual(state, {
    workspaces: [first, archived],
    currentId: archived.id,
    persistInitial: false,
    issue: null,
  });
});

test("a stale current-workspace ID falls back to the first stored workspace", () => {
  const first = createWorkspace("First");
  const second = createWorkspace("Second");
  const state = hydrateWorkspaceState({ kind: "ok", workspaces: [first, second] }, "missing-id", () => {
    throw new Error("must not create a new workspace");
  });

  assert.equal(state.currentId, first.id);
  assert.deepEqual(state.workspaces, [first, second]);
  assert.equal(state.persistInitial, false);
});

test("invalid storage remains a recovery issue and is not marked for initial persistence", () => {
  const raw = "{bad";
  const workspace = createWorkspace("Temporary chat");
  const state = hydrateWorkspaceState({ kind: "invalid", raw }, null, () => workspace);

  assert.deepEqual(state, {
    workspaces: [workspace],
    currentId: workspace.id,
    persistInitial: false,
    issue: { kind: "invalid", raw },
  });
});

test("unavailable storage does not mark the temporary workspace for persistence", () => {
  const workspace = createWorkspace("Temporary chat");
  const state = hydrateWorkspaceState({ kind: "unavailable" }, null, () => workspace);

  assert.deepEqual(state, {
    workspaces: [workspace],
    currentId: workspace.id,
    persistInitial: false,
    issue: { kind: "unavailable" },
  });
});

function quotaError(): Error {
  const error = new Error("The quota has been exceeded.");
  error.name = "QuotaExceededError";
  return error;
}

test("a successful workspace write is reported as saved", () => {
  const written = new Map<string, string>();
  const outcome = withLocalStorage(
    { getItem: () => null, setItem: (key, value) => void written.set(key, value) },
    () => writeWorkspaces([createWorkspace("Saved")])
  );
  assert.deepEqual(outcome, { saved: true });
  assert.equal(written.has(KEY), true);
});

test("a full store is reported as a quota failure, not as a save", () => {
  const outcome = withLocalStorage(
    { getItem: () => null, setItem: () => { throw quotaError(); } },
    () => writeWorkspaces([createWorkspace("Too big")])
  );
  assert.deepEqual(outcome, { saved: false, reason: "quota" });
});

test("a refused write for another reason is reported as unavailable", () => {
  const outcome = withLocalStorage(
    { getItem: () => null, setItem: () => { throw new Error("SecurityError"); } },
    () => writeWorkspaces([createWorkspace("Private")])
  );
  assert.deepEqual(outcome, { saved: false, reason: "unavailable" });
});

test("missing localStorage is reported as unavailable for writes", () => {
  assert.deepEqual(withLocalStorage(undefined, () => writeWorkspaces([])), {
    saved: false,
    reason: "unavailable",
  });
});

test("a throwing current-ID read is non-fatal and returns null", () => {
  const throwing = { getItem: () => { throw new Error("SecurityError"); } } as StorageStub;
  assert.equal(withLocalStorage(throwing, () => readCurrentId()), null);
});

test("a current-ID write failure is reported, not thrown", () => {
  const outcome = withLocalStorage(
    { getItem: () => null, setItem: () => { throw quotaError(); } },
    () => writeCurrentId("abc")
  );
  assert.deepEqual(outcome, { saved: false, reason: "quota" });
});

test("an in-memory export reads back as the same workspaces", () => {
  const workspace = { ...createWorkspace("Export me"), archivedAt: "2026-11-10T12:00:00.000Z" };
  const text = exportWorkspacesText([workspace]);
  const result = withLocalStorage(storageReturning(text), () => readWorkspacesResult());
  assert.deepEqual(result, { kind: "ok", workspaces: [workspace] });
});

test("a recovery export of malformed data is the original raw value", () => {
  const raw = '[{"id":"half-written"';
  const result = withLocalStorage(storageReturning(raw), () => readWorkspacesResult());
  assert.equal(result.kind, "invalid");
  assert.equal(result.kind === "invalid" ? result.raw : null, raw);
});

function memoryStorage(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

test("erasing app data removes only this app's keys and leaves other origin storage alone", () => {
  const storage = memoryStorage({
    [KEY]: "[]",
    [BYOK_STORAGE]: '{"key":"sk-test-SECRET"}',
    "some-other-app:theme": "dark",
  });
  const removed = withLocalStorage(storage, () => eraseLocal());
  assert.equal(removed, 2);
  assert.equal(storage.values.has(KEY), false);
  assert.equal(storage.values.has(BYOK_STORAGE), false);
  assert.equal(storage.values.get("some-other-app:theme"), "dark");
});

test("workspace exports never contain the saved model credential", () => {
  const storage = memoryStorage({ [BYOK_STORAGE]: '{"key":"sk-test-SECRET","remember":true}' });
  const text = withLocalStorage(storage, () => {
    const workspace = createWorkspace("Boundary check");
    return exportWorkspacesText([workspace]);
  });
  assert.equal(text.includes("sk-test-SECRET"), false);
});
