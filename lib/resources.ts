import type { Analysis } from "./schema";
import { newId, type Workspace } from "./workspace";

/**
 * Folders and resources inside a workspace.
 *
 * A workspace used to be a flat thread. That works until someone has three
 * plans and wants the two about pricing kept apart from the one about hiring.
 * So: folders hold things, and a resource is anything worth keeping — an
 * analysis, a note someone typed, a file someone attached.
 *
 * The model may propose changes to this tree. It may not make them. Everything
 * that arrives from a model is run through `plan()` below, which decides what is
 * applicable and what needs a person.
 */

export type ResourceKind = "analysis" | "note" | "file";

export type Resource = {
  id: string;
  kind: ResourceKind;
  title: string;
  /** For notes and files: the text itself or a short excerpt. */
  body?: string;
  /** For analyses: the report it points at. */
  analysisId?: string;
  /** The folder it sits in, or null for the top level. */
  folderId: string | null;
  createdAt: string;
  /** Where it came from, so a resource the model created is distinguishable. */
  origin: "you" | "model" | "attach";
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  origin: "you" | "model";
};

/** The operations a model (or a person) can ask for. Deliberately a closed set. */
export const ACTIONS = ["create_folder", "rename_folder", "move", "create_note", "delete"] as const;
export type ActionName = (typeof ACTIONS)[number];

export type ResourceAction = {
  action: ActionName;
  /** Target folder. */
  folderId?: string | null;
  /** The folder being renamed or moved. */
  targetFolderId?: string;
  /** The resource being moved or deleted. */
  resourceId?: string;
  /** A new folder's name, or a note's name. */
  name?: string;
  /** Note text. */
  body?: string;
  /** Why. Shown to the person asked to approve a deletion. */
  reason?: string;
};

export type Verdict = {
  action: ResourceAction;
  /** What it will do, in one line, for a person to read. */
  summary: string;
  /** Applied without asking: creating and moving loses nothing. */
  applies: boolean;
  /**
   * Deleting is never automatic. A model that can destroy a user's work without
   * a click is a model that eventually will.
   */
  needsApproval: boolean;
  /** Set when the action cannot be applied at all. */
  rejectedBecause?: string;
};

const LIMITS = { folders: 40, resources: 400, name: 60, body: 4000, actions: 8 } as const;

/**
 * Read the operations out of a model's reply.
 *
 * Returns [] rather than throwing: a model that asks for nonsense should cost
 * the user nothing, not break the turn it was asked in.
 */
export function parseActions(value: unknown): ResourceAction[] {
  if (!value || typeof value !== "object") return [];
  const raw = (value as { actions?: unknown }).actions;
  if (!Array.isArray(raw)) return [];
  const kept: ResourceAction[] = [];
  for (const entry of raw.slice(0, LIMITS.actions)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const action = e.action;
    if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) continue;
    kept.push({
      action: action as ActionName,
      folderId: typeof e.folderId === "string" || e.folderId === null ? (e.folderId as string | null) : undefined,
      targetFolderId: typeof e.targetFolderId === "string" ? e.targetFolderId : undefined,
      resourceId: typeof e.resourceId === "string" ? e.resourceId : undefined,
      name: typeof e.name === "string" ? e.name.slice(0, LIMITS.name) : undefined,
      body: typeof e.body === "string" ? e.body.slice(0, LIMITS.body) : undefined,
      reason: typeof e.reason === "string" ? e.reason.slice(0, 200) : undefined,
    });
  }
  return kept;
}

/**
 * Decide what each proposed action does.
 *
 * This is where the model's reach ends: it can describe an intent, and this
 * function says whether that intent is legal, whether it is safe, and what a
 * person will read before anything happens.
 */
export function plan(actions: ResourceAction[], workspace: Workspace): Verdict[] {
  const folders = new Map(workspace.folders.map((f) => [f.id, f]));
  const resources = new Map(workspace.resources.map((r) => [r.id, r]));
  const created: string[] = [];

  return actions.map((action) => {
    const base = { action } as Pick<Verdict, "action">;

    const folderProblem = (): string | null => {
      if (action.folderId === null || action.folderId === undefined) return null;
      if (created.includes(action.folderId)) return null;
      const target = folders.get(action.folderId);
      if (!target) return `There is no folder with id ${action.folderId}.`;
      return null;
    };

    switch (action.action) {
      case "create_folder": {
        const name = (action.name ?? "").trim();
        if (!name) return { ...base, summary: "Create a folder with no name", applies: false, needsApproval: false, rejectedBecause: "A folder needs a name." };
        if (workspace.folders.length + created.length >= LIMITS.folders) {
          return { ...base, summary: `Create “${name}”`, applies: false, needsApproval: false, rejectedBecause: `That would be more than ${LIMITS.folders} folders.` };
        }
        const problem = folderProblem();
        if (problem) return { ...base, summary: `Create “${name}”`, applies: false, needsApproval: false, rejectedBecause: problem };
        const id = `f:${newId()}`;
        created.push(id);
        return {
          ...base,
          action: { ...action, name, folderId: action.folderId ?? null },
          summary: `Create the folder “${name}”${action.folderId ? " inside another folder" : ""}`,
          applies: true,
          needsApproval: false,
        };
      }

      case "rename_folder": {
        const target = action.targetFolderId ? folders.get(action.targetFolderId) : undefined;
        if (!target) return { ...base, summary: "Rename a folder", applies: false, needsApproval: false, rejectedBecause: "No such folder." };
        const name = (action.name ?? "").trim();
        if (!name) return { ...base, summary: "Rename a folder", applies: false, needsApproval: false, rejectedBecause: "A folder needs a name." };
        return { ...base, action: { ...action, name }, summary: `Rename “${target.name}” to “${name}”`, applies: true, needsApproval: false };
      }

      case "move": {
        if (!action.resourceId) return { ...base, summary: "Move something", applies: false, needsApproval: false, rejectedBecause: "Nothing was named to move." };
        const resource = resources.get(action.resourceId);
        if (!resource) return { ...base, summary: "Move something", applies: false, needsApproval: false, rejectedBecause: "No such resource." };
        const problem = folderProblem();
        if (problem) return { ...base, summary: `Move “${resource.title}”`, applies: false, needsApproval: false, rejectedBecause: problem };
        const destination = action.folderId ? folders.get(action.folderId)?.name ?? "a new folder" : "the top level";
        return { ...base, summary: `Move “${resource.title}” to ${destination}`, applies: true, needsApproval: false };
      }

      case "create_note": {
        const name = (action.name ?? "").trim();
        const body = (action.body ?? "").trim();
        if (!name && !body) return { ...base, summary: "Write a note", applies: false, needsApproval: false, rejectedBecause: "A note needs text." };
        const problem = folderProblem();
        if (problem) return { ...base, summary: `Write “${name || body.slice(0, 30)}”`, applies: false, needsApproval: false, rejectedBecause: problem };
        return {
          ...base,
          action: { ...action, name: name || body.slice(0, 40), body: body.slice(0, LIMITS.body) },
          summary: `Write a note, “${(name || body).slice(0, 48)}”`,
          applies: true,
          needsApproval: false,
        };
      }

      case "delete": {
        const parts: string[] = [];
        if (action.resourceId) {
          const resource = resources.get(action.resourceId);
          if (!resource) return { ...base, summary: "Delete something", applies: false, needsApproval: false, rejectedBecause: "No such resource." };
          parts.push(`“${resource.title}”`);
        }
        if (action.targetFolderId) {
          const folder = folders.get(action.targetFolderId);
          if (!folder) return { ...base, summary: "Delete a folder", applies: false, needsApproval: false, rejectedBecause: "No such folder." };
          const inside = workspace.resources.filter((r) => r.folderId === folder.id).length;
          const children = workspace.folders.filter((f) => f.parentId === folder.id).length;
          parts.push(`the folder “${folder.name}”${inside + children > 0 ? ` and the ${inside + children} thing${inside + children === 1 ? "" : "s"} inside it` : ""}`);
        }
        if (parts.length === 0) return { ...base, summary: "Delete something", applies: false, needsApproval: false, rejectedBecause: "Nothing was named to delete." };

        return {
          ...base,
          summary: `Delete ${parts.join(" and ")}`,
          // Never automatic, and never silent.
          applies: false,
          needsApproval: true,
        };
      }

      default:
        return { ...base, summary: "Unknown action", applies: false, needsApproval: false, rejectedBecause: "Not an action this app performs." };
    }
  });
}

/** Apply the verdicts that do not need a person. Returns the new tree. */
export function apply(certain: Verdict[], workspace: Workspace): Workspace {
  let next = workspace;
  for (const verdict of certain) {
    if (!verdict.applies) continue;
    next = applyOne(verdict.action, next);
  }
  return next;
}

/** Apply one action, including a deletion a person approved. */
export function applyOne(action: ResourceAction, workspace: Workspace): Workspace {
  const now = new Date().toISOString();

  const addFolder = (folder: Folder): Workspace => ({
    ...workspace,
    folders: [...workspace.folders, folder],
    updatedAt: now,
  });

  const addResource = (resource: Resource): Workspace => ({
    ...workspace,
    resources: [...workspace.resources, resource],
    updatedAt: now,
  });

  switch (action.action) {
    case "create_folder": {
      const name = (action.name ?? "Untitled").trim();
      // Ids are generated here, so a model cannot choose one that collides.
      return addFolder({
        id: `f:${newId()}`,
        name,
        parentId: action.folderId ?? null,
        createdAt: now,
        origin: "model",
      });
    }

    case "rename_folder": {
      if (!action.targetFolderId) return workspace;
      return {
        ...workspace,
        folders: workspace.folders.map((f) =>
          f.id === action.targetFolderId ? { ...f, name: (action.name ?? f.name).trim() } : f
        ),
        updatedAt: now,
      };
    }

    case "move": {
      if (!action.resourceId) return workspace;
      return {
        ...workspace,
        resources: workspace.resources.map((r) =>
          r.id === action.resourceId ? { ...r, folderId: action.folderId ?? null } : r
        ),
        updatedAt: now,
      };
    }

    case "create_note": {
      const body = (action.body ?? "").trim();
      return addResource({
        id: `r:${newId()}`,
        kind: "note",
        title: (action.name ?? body.slice(0, 40) ?? "Note").trim(),
        body,
        folderId: action.folderId ?? null,
        createdAt: now,
        origin: "model",
      });
    }

    case "delete": {
      const removedFolders = new Set<string>();
      if (action.targetFolderId) {
        // A folder takes its children with it; anything loose inside is lifted
        // to the top level rather than silently destroyed.
        const collect = (id: string) => {
          removedFolders.add(id);
          for (const child of workspace.folders.filter((f) => f.parentId === id)) collect(child.id);
        };
        collect(action.targetFolderId);
      }
      return {
        ...workspace,
        folders: workspace.folders.filter((f) => !removedFolders.has(f.id)),
        resources: workspace.resources
          .filter((r) => r.id !== action.resourceId)
          .map((r) => (r.folderId && removedFolders.has(r.folderId) ? { ...r, folderId: null } : r)),
        updatedAt: now,
      };
    }

    default:
      return workspace;
  }
}

/** Everything a person can see, arranged: folders first, then loose resources. */
export function tree(workspace: Workspace): {
  root: Resource[];
  folders: { folder: Folder; items: Resource[] }[];
} {
  return {
    root: workspace.resources.filter((r) => !r.folderId),
    folders: workspace.folders.map((folder) => ({
      folder,
      items: workspace.resources.filter((r) => r.folderId === folder.id),
    })),
  };
}

/** Turn a finished analysis into a resource, so a report can be filed. */
export function resourceFromAnalysis(analysis: Analysis, folderId: string | null = null): Resource {
  return {
    id: `r:${analysis.id}`,
    kind: "analysis",
    title: analysis.title,
    analysisId: analysis.id,
    body: analysis.summary,
    folderId,
    createdAt: analysis.createdAt,
    origin: "you",
  };
}
