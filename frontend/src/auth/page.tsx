import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { RoleId, SessionUser } from "../common/types";
import { demoCredentials, isDemoMode, readSession, rolePath } from "../common/data";
import { BuildingIcon } from "../common/components";
import { ModeToggle } from "../common/mode-toggle";
import { apiFetch } from "../common/api";

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<RoleId>("owner");
  const [email, setEmail] = useState(demoCredentials.owner.email);
  const [password, setPassword] = useState(demoCredentials.owner.password);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const session = readSession();
  const demoMode = isDemoMode();

  useEffect(() => {
    if (session) navigate(rolePath(session.role), { replace: true });
  }, [navigate, session?.role]);

  const selectDemoRole = (nextRole: RoleId) => {
    setRole(nextRole);
    setEmail(demoCredentials[nextRole].email);
    setPassword(demoCredentials[nextRole].password);
    setError("");
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
      });
      const result = await response.json() as { user?: SessionUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || `Sign-in failed (${response.status})`);
      localStorage.setItem("buildtrack-session", JSON.stringify(result.user));
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination?.startsWith(rolePath(role)) ? destination : rolePath(role), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="signin-page">
    <header className="signin-nav"><Link className="brand landing-brand" to="/"><span className="brand-mark"><BuildingIcon /></span><span className="brand-copy"><strong>Vanya BuildTrack</strong><small>Construction Manager</small></span></Link><div className="signin-nav-actions"><ModeToggle /><Link to="/" className="button button-outline signin-back">← Back to home</Link></div></header>
    <section className="signin-layout">
      <div className="signin-story"><span className="landing-kicker"><i /> YOUR PROJECTS, IN SYNC</span><h1>Good work<br />starts with<br /><span>a clear view.</span></h1><p>One workspace for the people planning, building, and bringing every project to life.</p><div className="signin-story-note"><span>“</span><strong>Every site update brings the whole team closer.</strong><small>VANYA BUILDTRACK</small></div></div>
      <div className="signin-card">
        <span className="signin-card-icon"><BuildingIcon /></span><span className="panel-kicker">WELCOME BACK</span><h2>Sign in to BuildTrack</h2><p className="signin-description">Choose your workspace role and enter your details.</p>
        <form onSubmit={signIn}>
          <label>Sign in as<select value={role} onChange={(event) => selectDemoRole(event.target.value as RoleId)}><option value="owner">Owner</option><option value="employee">Employee</option><option value="client">Client</option></select></label>
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
          {error && <div className="signin-error" role="alert">{error}</div>}
          <button className="button button-primary signin-submit" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"} <span>→</span></button>
        </form>
        {demoMode ? <div className="demo-access"><div className="demo-access-heading"><span>DEMO ACCESS</span><span>Pick a role to fill its demo login</span></div><div className="demo-role-list">{(["owner", "employee", "client"] as RoleId[]).map((demoRole) => <button type="button" key={demoRole} className={role === demoRole ? "demo-role-active" : ""} onClick={() => selectDemoRole(demoRole)}><span>{demoCredentials[demoRole].label}</span><span>{demoCredentials[demoRole].email}</span></button>)}</div><small>Demo sign-in · data stays in this browser</small></div> : <p className="signin-description">Real mode signs in against the SQLite workspace database.</p>}
      </div>
    </section>
    <footer className="signin-footer">© 2026 Vanya BuildTrack <span>·</span> Built for the people who build.</footer>
  </main>;
}
