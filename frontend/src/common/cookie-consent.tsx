import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type CookieChoice = "essential" | "all";
const storageKey = "buildtrack-cookie-preference";

function readChoice(): CookieChoice | null {
  const saved = localStorage.getItem(storageKey);
  return saved === "essential" || saved === "all" ? saved : null;
}

export function CookieConsent() {
  const { pathname } = useLocation();
  const [choice, setChoice] = useState<CookieChoice | null>(readChoice);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  const saveChoice = (nextChoice: CookieChoice) => {
    localStorage.setItem(storageKey, nextChoice);
    setChoice(nextChoice);
    setSettingsOpen(false);
  };

  if (pathname !== "/" && pathname !== "/signin") return null;

  return <>
    {choice === null
      ? <aside className="cookie-notice" aria-label="Cookie and storage preferences">
        <div><strong>Cookie & storage preferences</strong><p>BuildTrack uses essential browser storage for your demo sign-in and to remember this choice. No advertising or analytics cookies are active. <Link to="/privacy-policy">Privacy Policy</Link></p></div>
        <div className="cookie-actions">
          <button className="button button-outline" onClick={() => saveChoice("essential")}>Essential only</button>
          <button className="button button-primary" onClick={() => saveChoice("all")}>Accept all</button>
          <button className="cookie-settings-link" onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
      </aside>
      : <button className="cookie-preferences-button" onClick={() => setSettingsOpen(true)}>Cookie settings</button>}
    {settingsOpen && <div className="modal-scrim cookie-settings-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
      <section className="modal-card cookie-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title">
        <div className="modal-heading"><div><span className="panel-kicker">PRIVACY PREFERENCES</span><h2 id="cookie-settings-title">Cookie & storage settings</h2></div><button className="icon-button modal-close" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button></div>
        <div className="cookie-category"><div><strong>Essential browser storage</strong><p>Required for the demo sign-in session and to save your preference. Always active.</p></div><span>Always on</span></div>
        <div className="cookie-category"><div><strong>Analytics and advertising</strong><p>No analytics or advertising cookies are used by this demo.</p></div><span>Not active</span></div>
        <p className="cookie-policy-link"><Link to="/data-usage" onClick={() => setSettingsOpen(false)}>Read about data usage</Link></p>
        <div className="modal-actions"><button className="button button-outline" onClick={() => saveChoice("essential")}>Essential only</button><button className="button button-primary" onClick={() => saveChoice("all")}>Save preferences</button></div>
      </section>
    </div>}
  </>;
}
