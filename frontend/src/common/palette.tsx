import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";
import { isDemoMode } from "./data";
import type { PaletteId } from "./types";

export const paletteOptions: { id: PaletteId; name: string; description: string; colors: string[] }[] = [
  { id: "current", name: "Current · Terracotta", description: "The warm terracotta and soft neutral palette in use today.", colors: ["#b65b38", "#2f241f", "#f7f2ee"] },
  { id: "previous", name: "Previous · Construction orange", description: "The earlier vivid orange, charcoal, and off-white palette.", colors: ["#e94f0b", "#211e1c", "#faf9f7"] },
  { id: "reference", name: "Reference · Evergreen", description: "Forest green, soft cream, and lime inspired by your reference image.", colors: ["#164a3a", "#faf9f2", "#d9ed70"] }
];

type PaletteContextValue = {
  palette: PaletteId;
  loading: boolean;
  saving: boolean;
  updatePalette: (palette: PaletteId, ownerEmail: string) => Promise<void>;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

function isPaletteId(value: unknown): value is PaletteId {
  return value === "current" || value === "previous" || value === "reference";
}

function applyPalette(palette: PaletteId) {
  document.documentElement.dataset.palette = palette;
}

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState<PaletteId>("current");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadPalette = async () => {
      try {
        const response = await apiFetch("/api/settings/palette");
        if (!response.ok) throw new Error(`Palette settings request failed (${response.status})`);
        const result = await response.json() as { palette?: unknown };
        if (!isPaletteId(result.palette)) throw new Error("The workspace has an invalid color palette setting.");
        if (active) setPalette(result.palette);
      } catch (error) {
        console.error("Unable to load the workspace color palette:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPalette();
    return () => { active = false; };
  }, []);

  useEffect(() => applyPalette(palette), [palette]);

  useEffect(() => {
    if (isDemoMode()) return;
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      let update: { resource?: unknown };
      try {
        update = JSON.parse(event.data) as typeof update;
      } catch (error) {
        console.error("Unable to parse a real-time workspace update:", error);
        return;
      }
      if (update.resource !== "settings") return;
      void (async () => {
        try {
          const response = await apiFetch("/api/settings/palette");
          if (!response.ok) throw new Error(`Palette settings request failed (${response.status})`);
          const result = await response.json() as { palette?: unknown };
          if (!isPaletteId(result.palette)) throw new Error("The workspace has an invalid color palette setting.");
          setPalette(result.palette);
        } catch (error) {
          console.error("Unable to refresh the workspace color palette:", error);
        }
      })();
    };
    events.onerror = () => {
      console.error("Real-time workspace connection interrupted; the browser will retry automatically.");
    };
    return () => events.close();
  }, []);

  const updatePalette = async (nextPalette: PaletteId, ownerEmail: string) => {
    setSaving(true);
    try {
      const response = await apiFetch(`/api/settings/palette?email=${encodeURIComponent(ownerEmail)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palette: nextPalette })
      });
      const result = await response.json() as { palette?: unknown; error?: string };
      if (!response.ok) throw new Error(result.error || `Palette settings update failed (${response.status})`);
      if (!isPaletteId(result.palette) || result.palette !== nextPalette) {
        throw new Error("The server returned an invalid color palette setting.");
      }
      setPalette(result.palette);
    } finally {
      setSaving(false);
    }
  };

  return <PaletteContext.Provider value={{ palette, loading, saving, updatePalette }}>{children}</PaletteContext.Provider>;
}

export function usePalette() {
  const context = useContext(PaletteContext);
  if (!context) throw new Error("usePalette must be used within a PaletteProvider.");
  return context;
}
