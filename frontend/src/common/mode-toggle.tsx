import { useState } from "react";
import { isDemoMode, setDemoMode } from "./data";

export function ModeToggle() {
  const [demoMode, setDemoModeState] = useState(isDemoMode);

  const toggleMode = () => {
    const nextMode = !demoMode;
    setDemoMode(nextMode);
    setDemoModeState(nextMode);
    window.location.assign("/signin");
  };

  return <button
    type="button"
    className="mode-toggle"
    aria-pressed={demoMode}
    aria-label={`Demo mode ${demoMode ? "on" : "off"}. Switch to ${demoMode ? "real" : "demo"} mode.`}
    onClick={toggleMode}
  >
    <span className="mode-toggle-label">DEMO MODE</span>
    <span className={`mode-toggle-switch ${demoMode ? "mode-toggle-enabled" : ""}`} aria-hidden="true"><i /></span>
    <span className="mode-toggle-state">{demoMode ? "On" : "Off"}</span>
  </button>;
}
