/**
 * Deleting everything, from one place.
 *
 * The app writes to eight local-storage keys and, when it is configured, to a
 * `analyses` table. Before this file there was no single answer to "remove my
 * data" — a person cleared chats one at a time and had no way at all to remove a
 * key they had pasted.
 *
 * The list is enumerated rather than using `localStorage.clear()`, which would
 * also wipe the preferences of every other app on the same origin — and this app
 * does not own the origin's whole storage. Enumerating also lets the caller keep
 * the two preferences that are not data (panel state, thinking level) if it wants
 * to.
 */

/** Every key this app writes that holds something a person typed or chose. */
export const DATA_KEYS = [
  "load-bearing:workspaces",
  "load-bearing:current-workspace",
  "load-bearing:analyses",
  "load-bearing:plans",
  "load-bearing:llm",
] as const;

/** Preferences: not data, no reason to erase them to erase content. */
export const PREFERENCE_KEYS = [
  "load-bearing:panel-open",
  "load-bearing:rail-open",
  "load-bearing:thinking",
] as const;

export const ALL_KEYS = [...DATA_KEYS, ...PREFERENCE_KEYS];

/**
 * How much is actually stored, in bytes, so the page can say what will be lost
 * before it is lost. UTF-16, so two bytes per character — close enough to be
 * honest, and it is the unit the browser quotes anyway.
 */
export function localUsage(): { keys: number; bytes: number } {
  if (typeof localStorage === "undefined") return { keys: 0, bytes: 0 };
  let keys = 0;
  let bytes = 0;
  for (const key of ALL_KEYS) {
    const value = localStorage.getItem(key);
    if (value === null) continue;
    keys += 1;
    bytes += (key.length + value.length) * 2;
  }
  return { keys, bytes };
}

/** Everything in this browser. Returns how many keys went. */
export function eraseLocal(): number {
  if (typeof localStorage === "undefined") return 0;
  let removed = 0;
  for (const key of ALL_KEYS) {
    if (localStorage.getItem(key) === null) continue;
    localStorage.removeItem(key);
    removed += 1;
  }
  return removed;
}

/** A size a person can read. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102) / 10} KB`;
  return `${Math.round(bytes / (1024 * 1024) * 10) / 10} MB`;
}
