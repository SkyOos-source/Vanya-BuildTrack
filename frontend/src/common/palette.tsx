import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { readSession } from "./data";
import type { PaletteId } from "./types";

export const paletteOptions: { id: PaletteId; name: string; description: string; colors: string[] }[] = [
  { id: "current", name: "Current · Terracotta", description: "The warm terracotta and soft neutral palette in use today.", colors: ["#b65b38", "#2f241f", "#f7f2ee"] },
  { id: "previous", name: "Default · Construction orange", description: "Vivid construction orange, charcoal, and off-white.", colors: ["#e94f0b", "#211e1c", "#faf9f7"] },
  { id: "reference", name: "Reference · Evergreen", description: "Forest green, soft cream, and lime inspired by your reference image.", colors: ["#164a3a", "#faf9f2", "#d9ed70"] }
];

type PaletteContextValue = {
  palette: PaletteId;
  updatePalette: (palette: PaletteId) => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

const defaultPalette: PaletteId = "previous";
const paletteStoragePrefix = "buildtrack-user-palette";

function isPaletteId(value: unknown): value is PaletteId {
  return value === "current" || value === "previous" || value === "reference";
}

function currentUserPaletteKey() {
  const session = readSession();
  return session ? `${paletteStoragePrefix}:${session.role}:${session.email.toLowerCase()}` : null;
}

function readUserPalette(): PaletteId {
  const key = currentUserPaletteKey();
  if (!key) return defaultPalette;
  const saved = localStorage.getItem(key);
  if (saved === null) return defaultPalette;
  if (isPaletteId(saved)) return saved;
  throw new Error("Saved user color palette is invalid.");
}

function applyPalette(palette: PaletteId) {
  document.documentElement.dataset.palette = palette;
}

export function PaletteProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [palette, setPalette] = useState<PaletteId>(() => {
    try {
      return readUserPalette();
    } catch (error) {
      console.error("Unable to load the signed-in user's color palette:", error);
      return defaultPalette;
    }
  });

  useEffect(() => {
    try {
      setPalette(readUserPalette());
    } catch (error) {
      console.error("Unable to load the signed-in user's color palette:", error);
      setPalette(defaultPalette);
    }
    const paletteKey = currentUserPaletteKey();
    const syncPalette = (event: StorageEvent) => {
      if (event.key !== paletteKey) return;
      try {
        setPalette(readUserPalette());
      } catch (error) {
        console.error("Unable to sync the signed-in user's color palette:", error);
        setPalette(defaultPalette);
      }
    };
    window.addEventListener("storage", syncPalette);
    return () => window.removeEventListener("storage", syncPalette);
  }, [location.pathname]);

  useEffect(() => applyPalette(palette), [palette]);

  const updatePalette = (nextPalette: PaletteId) => {
    const key = currentUserPaletteKey();
    if (!key) throw new Error("Sign in before choosing a personal color palette.");
    localStorage.setItem(key, nextPalette);
    setPalette(nextPalette);
  };

  return <PaletteContext.Provider value={{ palette, updatePalette }}>{children}</PaletteContext.Provider>;
}

export function PalettePicker({ onError }: { onError: (message: string) => void }) {
  const { palette, updatePalette } = usePalette();

  const selectPalette = (nextPalette: PaletteId) => {
    try {
      updatePalette(nextPalette);
    } catch (error) {
      console.error("Unable to update the personal color palette:", error);
      onError(error instanceof Error ? error.message : "Could not update your color palette.");
    }
  };

  return <div className="palette-card-grid" role="group" aria-label="Personal color palette">
    {paletteOptions.map((option) => <button
        type="button"
        className={`palette-card ${palette === option.id ? "palette-card-selected" : ""}`}
        key={option.id}
        aria-pressed={palette === option.id}
        onClick={() => void selectPalette(option.id)}
      >
        <span className="palette-card-colors" aria-hidden="true">{option.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
        <span className="palette-card-title">{option.name}</span>
        <span className="palette-card-description">{option.description}</span>
        {palette === option.id && <span className="palette-card-check" aria-label="Selected">✓</span>}
      </button>)}
  </div>;
}

export function usePalette() {
  const context = useContext(PaletteContext);
  if (!context) throw new Error("usePalette must be used within a PaletteProvider.");
  return context;
}
