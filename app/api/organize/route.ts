import { z } from "zod";
import { hasApiKey, structuredPass } from "@/lib/ai";
import { parseActions, plan, type ResourceAction } from "@/lib/resources";
import type { Workspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Ask the model to tidy the workspace, and let it propose.
 *
 * The model never touches storage. It returns a list of operations; this route
 * turns each into a verdict (lib/resources.ts) and the client applies the safe
 * ones. Anything destructive comes back flagged for a person to approve, which
 * is the whole reason this is a proposal endpoint rather than a mutation one.
 */

const ActionSchema = z.object({
  actions: z
    .array(
      z.object({
        action: z.enum(["create_folder", "rename_folder", "move", "create_note", "delete"]),
        folderId: z.string().nullable().optional().describe("Destination folder id, or null for the top level."),
        targetFolderId: z.string().optional().describe("The folder being renamed or deleted."),
        resourceId: z.string().optional().describe("The resource being moved or deleted."),
        name: z.string().optional(),
        body: z.string().optional(),
        reason: z.string().optional().describe("One line for the person asked to approve a deletion."),
      })
    )
    .max(8),
});

const SYSTEM = `You are tidying a Load-Bearing workspace.

You get the folders and resources that exist, with their ids. You may propose at most eight operations.

Rules you never break:
- Use only ids that appear below. Never invent an id.
- Creating a folder, renaming one, moving a resource and writing a note are safe: propose them freely when they make the workspace easier to read.
- Deleting is different. Propose a delete only when the thing is clearly superseded — a duplicate note, an old copy of the same plan — and always give a "reason" a person can judge in one line.
- Group by what the work is about, not by when it arrived. "Pricing" and "Hiring" are folders; "January" is not.
- If the workspace is already tidy, return an empty list. Tidying something that works is a cost, not a kindness.`;

export async function POST(request: Request) {
  let body: { workspace?: Workspace; instruction?: string };
  try {
    body = (await request.json()) as { workspace?: Workspace; instruction?: string };
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const workspace = body.workspace;
  if (!workspace || !Array.isArray(workspace.resources)) {
    return Response.json({ error: "Send the workspace to organise." }, { status: 400 });
  }

  // Demo mode has no model. It still answers, but with nothing — an inbox that
  // quietly stays where it is, rather than a fake reorganisation.
  if (!hasApiKey()) {
    return Response.json({
      actions: [] as ResourceAction[],
      verdicts: [],
      mode: "demo",
      note: "No model is configured, so nothing was reorganised. Your folders are unchanged.",
    });
  }

  const folders = workspace.folders
    .map((f) => `- ${f.id}  "${f.name}"${f.parentId ? ` (inside ${f.parentId})` : ""}`)
    .join("\n");
  const resources = workspace.resources
    .map(
      (r) =>
        `- ${r.id}  [${r.kind}] "${r.title}"${r.folderId ? ` in ${r.folderId}` : " at the top level"}${
          r.body ? ` — ${r.body.slice(0, 120)}` : ""
        }`
    )
    .join("\n");

  const user = [
    "FOLDERS",
    folders || "(none)",
    "",
    "RESOURCES",
    resources || "(none)",
    "",
    body.instruction?.trim()
      ? `INSTRUCTION FROM THE PERSON\n${body.instruction.trim().slice(0, 500)}`
      : "INSTRUCTION FROM THE PERSON\n(none — tidy what should be tidied, and leave the rest)",
  ].join("\n");

  try {
    const result = await structuredPass({
      system: SYSTEM,
      user,
      schema: ActionSchema,
      maxTokens: 1500,
    });

    const actions = parseActions(result.data);
    const verdicts = plan(actions, workspace);

    return Response.json({
      actions,
      verdicts,
      mode: "live",
      note: verdicts.some((v) => v.needsApproval)
        ? "Nothing was deleted. The deletions below are waiting for you."
        : "Applied. Nothing was removed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        error: /rate|429|overloaded|high demand/i.test(message)
          ? "The model is busy. Nothing was changed."
          : `Tidying failed (${message.slice(0, 120)}). Nothing was changed.`,
      },
      { status: 502 }
    );
  }
}
