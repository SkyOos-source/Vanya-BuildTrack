import { ownerAccount, workspaceSettings, type PaletteId } from "../../data/store";
import { failure, result } from "../shared";

const isPaletteId = (value: unknown): value is PaletteId =>
  value === "current" || value === "previous" || value === "reference";

export function getWorkspacePalette() {
  return result({ palette: workspaceSettings.palette });
}

export function updateWorkspacePalette(email: string, body: unknown) {
  if (email.trim().toLowerCase() !== ownerAccount.email) {
    return failure(403, "Only the workspace owner can change the color palette.");
  }
  if (!body || typeof body !== "object" || !isPaletteId((body as Record<string, unknown>).palette)) {
    return failure(400, "Choose a valid workspace color palette.");
  }
  workspaceSettings.palette = (body as { palette: PaletteId }).palette;
  return result({ palette: workspaceSettings.palette });
}
