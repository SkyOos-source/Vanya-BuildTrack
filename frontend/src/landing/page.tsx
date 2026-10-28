import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BuildingIcon } from "../common/components";
import { readSession, rolePath } from "../common/data";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return "prompt" in event && typeof event.prompt === "function" && "userChoice" in event;
}

export function LandingPage() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState<"ios" | "browser" | "error" | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(displayMode.matches);

    const handleDisplayModeChange = (event: MediaQueryListEvent) => setIsInstalled(event.matches);
    const handleBeforeInstallPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallHelp(null);
    };

    displayMode.addEventListener("change", handleDisplayModeChange);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      displayMode.removeEventListener("change", handleDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) {
      const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setInstallHelp(isIos ? "ios" : "browser");
      return;
    }

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setInstallPrompt(null);
    } catch (error) {
      console.error("Unable to open the BuildTrack app install prompt:", error);
      setInstallHelp("error");
    }
  };

  const session = readSession();
  if (session) return <Navigate to={rolePath(session.role)} replace />;

  return <main className="landing-page">
    <header className="landing-nav">
      <Link className="brand landing-brand" to="/"><span className="brand-mark"><BuildingIcon /></span><span className="brand-copy"><strong>BuildTrack</strong><small>Construction Manager</small></span></Link>
      <Link className="button button-outline" to="/signin">Sign in <span>↗</span></Link>
    </header>
    <section className="landing-hero">
      <span className="landing-symbol"><BuildingIcon /></span>
      <span className="landing-kicker"><i /> CONSTRUCTION, IN SYNC</span>
      <h1>Build smarter.<br /><span>Manage better.</span></h1>
      <p>The complete workspace for construction teams. Connect your projects, sites, people, and clients — from the first plan to the final handover.</p>
      <div className="landing-actions">
        <Link to="/signin" className="button button-primary landing-cta">Get started <span>→</span></Link>
        {!isInstalled && <button type="button" className="button button-outline landing-install" onClick={() => void installApp()}>Install app <span>↓</span></button>}
      </div>
      {installHelp && <aside className="landing-install-help" role="status">
        {installHelp === "ios" ? <>
          <strong>Install BuildTrack on your iPhone or iPad</strong>
          <ol>
            <li>Open this page in Safari.</li>
            <li>Tap the <strong>Share</strong> button <span aria-label="Share" role="img">↑</span>.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
          </ol>
        </> : installHelp === "error"
          ? "Could not open the install prompt. Use your browser menu to choose Install app or Add to Home Screen."
          : "To install BuildTrack, open your browser menu and choose Install app or Add to Home Screen."}
      </aside>}
      <div className="landing-highlights"><span>✓ Site progress, in real time</span><span>✓ Materials & expense tracking</span><span>✓ One view for every role</span></div>
    </section>
    <section className="landing-portals"><div><span className="panel-kicker">ONE PLATFORM, YOUR WHOLE TEAM</span><h2>Everyone building<br />from the same page.</h2></div><div className="portal-cards"><article><span>01 / OWNER</span><h3>Lead the project</h3><p>Projects, people, budgets, and progress — all within reach.</p></article><article><span>02 / EMPLOYEE</span><h3>Bring the site to life</h3><p>Daily updates, site tasks, materials, and team attendance.</p></article><article><span>03 / CLIENT</span><h3>See it take shape</h3><p>Milestones, photos, proposals, and a clear line to your team.</p></article></div></section>
    <footer className="landing-footer"><span>© 2026 Vanya BuildTrack</span><span>Made for the people who build.</span><nav aria-label="Legal"><Link to="/privacy-policy">Privacy Policy</Link><Link to="/data-usage">Data Usage</Link></nav></footer>
  </main>;
}
