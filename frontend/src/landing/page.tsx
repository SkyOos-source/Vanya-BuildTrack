import { Link } from "react-router-dom";
import { BuildingIcon } from "../common/components";

export function LandingPage() {
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
      <Link to="/signin" className="button button-primary landing-cta">Get started <span>→</span></Link>
      <div className="landing-highlights"><span>✓ Site progress, in real time</span><span>✓ Materials & expense tracking</span><span>✓ One view for every role</span></div>
    </section>
    <section className="landing-portals"><div><span className="panel-kicker">ONE PLATFORM, YOUR WHOLE TEAM</span><h2>Everyone building<br />from the same page.</h2></div><div className="portal-cards"><article><span>01 / OWNER</span><h3>Lead the project</h3><p>Projects, people, budgets, and progress — all within reach.</p></article><article><span>02 / EMPLOYEE</span><h3>Bring the site to life</h3><p>Daily updates, site tasks, materials, and team attendance.</p></article><article><span>03 / CLIENT</span><h3>See it take shape</h3><p>Milestones, photos, proposals, and a clear line to your team.</p></article></div></section>
    <footer className="landing-footer"><span>© 2026 Vanya BuildTrack</span><span>Made for the people who build.</span><nav aria-label="Legal"><Link to="/privacy-policy">Privacy Policy</Link><Link to="/data-usage">Data Usage</Link></nav></footer>
  </main>;
}
