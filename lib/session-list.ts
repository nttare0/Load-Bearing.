import type { Workspace } from "./workspace";

export const SESSION_GROUPS = [
  "Today",
  "Yesterday",
  "Previous 7 Days",
  "Previous 30 Days",
  "Older",
] as const;

export type SessionGroup = (typeof SESSION_GROUPS)[number];

export type SessionListItem = {
  workspace: Workspace;
  title: string;
  reports: number;
  messages: number;
};

/** Filter the local session index without losing matches in the original prompt or thread. */
export function searchSessions(
  items: SessionListItem[],
  query: string,
  includeArchived = false
): SessionListItem[] {
  const term = query.trim().toLocaleLowerCase();
  return items
    .filter(({ workspace }) => includeArchived || !workspace.archivedAt)
    .filter(({ workspace, title }) => {
      if (!term) return true;
      const content = [
        title,
        workspace.name,
        ...workspace.plans.map((plan) => plan.text),
        ...workspace.messages.map((message) => message.text),
        ...workspace.resources.flatMap((resource) => [resource.title, resource.body ?? ""]),
        ...workspace.folders.map((folder) => folder.name),
      ];
      return content.some((value) => value.toLocaleLowerCase().includes(term));
    })
    .toSorted((a, b) => Date.parse(b.workspace.updatedAt) - Date.parse(a.workspace.updatedAt));
}

/** Group sessions by the user's local calendar day, not elapsed 24-hour blocks. */
export function groupSessions(
  items: SessionListItem[],
  now = new Date()
): { label: SessionGroup; items: SessionListItem[] }[] {
  const groups = new Map<SessionGroup, SessionListItem[]>(SESSION_GROUPS.map((label) => [label, []]));
  for (const item of items) groups.get(sessionGroup(item.workspace.updatedAt, now))?.push(item);
  return SESSION_GROUPS.flatMap((label) => {
    const grouped = groups.get(label) ?? [];
    return grouped.length ? [{ label, items: grouped }] : [];
  });
}

export function sessionGroup(updatedAt: string, now = new Date()): SessionGroup {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return "Older";

  const date = new Date(timestamp);
  const today = localDayNumber(now);
  const itemDay = localDayNumber(date);
  const daysAgo = today - itemDay;
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo <= 7) return "Previous 7 Days";
  if (daysAgo <= 30) return "Previous 30 Days";
  return "Older";
}

function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}
