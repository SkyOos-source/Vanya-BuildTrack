import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { SessionUser } from "../common/types";
import { readSession, rolePath, saveAuthTokens } from "../common/data";
import { BuildingIcon, PasswordInput } from "../common/components";
import { apiFetch } from "../common/api";
import { withRetryGuidance } from "../common/utils";

type SetupOwner = { name: string; email: string; phone: string; password: string; confirmation: string };
const emptySetupOwners: SetupOwner[] = [
  { name: "", email: "", phone: "", password: "", confirmation: "" },
  { name: "", email: "", phone: "", password: "", confirmation: "" }
];

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const authSubmissionInFlight = useRef(false);
  const [authChallenge, setAuthChallenge] = useState<{ challengeId: string; phoneRequired: boolean; phoneHint?: string } | null>(null);
  const [enrollmentPhone, setEnrollmentPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const session = readSession();
  const [setupState, setSetupState] = useState<"checking" | "required" | "complete" | "error">("checking");
  const [setupAttempt, setSetupAttempt] = useState(0);
  const [setupCode, setSetupCode] = useState("");
  const [setupOwners, setSetupOwners] = useState<SetupOwner[]>(emptySetupOwners);
  const [setupError, setSetupError] = useState("");
  const [setupSuccess, setSetupSuccess] = useState("");
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const setupSubmissionInFlight = useRef(false);
  const notice = (location.state as { notice?: string } | null)?.notice;

  useEffect(() => {
    if (session) navigate(rolePath(session.role), { replace: true });
  }, [navigate, session?.role]);

  useEffect(() => {
    let active = true;
    setSetupState("checking");
    void apiFetch("/api/auth/setup/status", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { required?: boolean; error?: string };
      if (!response.ok || typeof result.required !== "boolean") {
        throw new Error(result.error || `Unable to check workspace setup (${response.status}).`);
      }
      if (active) setSetupState(result.required ? "required" : "complete");
    }).catch((cause) => {
      if (active) {
        setSetupError(cause instanceof Error ? cause.message : "Unable to check workspace setup.");
        setSetupState("error");
      }
    });
    return () => { active = false; };
  }, [setupAttempt]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authSubmissionInFlight.current) return;
    authSubmissionInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json() as { user?: SessionUser; accessToken?: string; refreshToken?: string; challengeId?: string; phoneRequired?: boolean; phoneHint?: string; error?: string };
      if (!response.ok) throw new Error(result.error || `Sign-in failed (${response.status})`);
      if (result.challengeId) {
        setAuthChallenge({ challengeId: result.challengeId, phoneRequired: result.phoneRequired === true, phoneHint: result.phoneHint });
        setError("");
        return;
      }
      if (!result.user) throw new Error(result.error || "Sign-in response did not include an account.");
      if (!result.accessToken || !result.refreshToken) throw new Error("Sign-in response did not include both session tokens.");
      localStorage.setItem("buildtrack-session", JSON.stringify(result.user));
      saveAuthTokens(result.accessToken, result.refreshToken);
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination?.startsWith(rolePath(result.user.role)) ? destination : rolePath(result.user.role), { replace: true });
    } catch (cause) {
      setError(withRetryGuidance(cause instanceof Error ? cause.message : "Sign-in failed."));
    } finally {
      authSubmissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  const sendVerificationCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authChallenge || authSubmissionInFlight.current) return;
    authSubmissionInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: authChallenge.challengeId,
          ...(authChallenge.phoneRequired ? { phone: enrollmentPhone } : {})
        })
      });
      const result = await response.json() as { phoneHint?: string; error?: string };
      if (!response.ok || !result.phoneHint) throw new Error(result.error || `Could not send verification code (${response.status}).`);
      setAuthChallenge({ ...authChallenge, phoneRequired: false, phoneHint: result.phoneHint });
    } catch (cause) {
      setError(withRetryGuidance(cause instanceof Error ? cause.message : "Could not send the verification code."));
    } finally {
      authSubmissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authChallenge || authSubmissionInFlight.current) return;
    authSubmissionInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: authChallenge.challengeId, code: verificationCode })
      });
      const result = await response.json() as { user?: SessionUser; accessToken?: string; refreshToken?: string; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || `Verification failed (${response.status}).`);
      if (!result.accessToken || !result.refreshToken) throw new Error("Verification response did not include both session tokens.");
      localStorage.setItem("buildtrack-session", JSON.stringify(result.user));
      saveAuthTokens(result.accessToken, result.refreshToken);
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination?.startsWith(rolePath(result.user.role)) ? destination : rolePath(result.user.role), { replace: true });
    } catch (cause) {
      setError(withRetryGuidance(cause instanceof Error ? cause.message : "Could not verify the code."));
    } finally {
      authSubmissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  const resendVerificationCode = async () => {
    if (!authChallenge || authSubmissionInFlight.current) return;
    authSubmissionInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: authChallenge.challengeId })
      });
      const result = await response.json() as { phoneHint?: string; error?: string };
      if (!response.ok || !result.phoneHint) throw new Error(result.error || `Could not send verification code (${response.status}).`);
      setAuthChallenge({ ...authChallenge, phoneRequired: false, phoneHint: result.phoneHint });
    } catch (cause) {
      setError(withRetryGuidance(cause instanceof Error ? cause.message : "Could not resend the verification code."));
    } finally {
      authSubmissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  const updateSetupOwner = (index: number, field: keyof SetupOwner, value: string) => {
    setSetupOwners((current) => current.map((owner, ownerIndex) =>
      ownerIndex === index ? { ...owner, [field]: value } : owner
    ));
  };

  const completeSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (setupSubmissionInFlight.current) return;
    setupSubmissionInFlight.current = true;
    setSetupSubmitting(true);
    setSetupError("");
    try {
      if (setupOwners.some((owner) => owner.password !== owner.confirmation)) {
        throw new Error("Each owner password and confirmation must match.");
      }
      const response = await apiFetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupCode,
          owners: setupOwners.map(({ name, email, phone, password }) => ({ name, email, phone, password }))
        })
      });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok || result.status !== "ok") {
        throw new Error(result.error || `Initial setup failed (${response.status}).`);
      }
      setSetupState("complete");
      setSetupSuccess("Owner accounts are ready. Sign in with the first owner account.");
      setEmail(setupOwners[0].email);
      setPassword("");
      setSetupCode("");
      setSetupOwners(emptySetupOwners);
    } catch (cause) {
      setSetupError(withRetryGuidance(cause instanceof Error ? cause.message : "Could not complete workspace setup."));
    } finally {
      setupSubmissionInFlight.current = false;
      setSetupSubmitting(false);
    }
  };

  const setupForm = <form onSubmit={completeSetup}>
    <label>One-time setup code<input autoComplete="off" value={setupCode} onChange={(event) => setSetupCode(event.target.value)} placeholder="Get this code from the VPS container logs" required /></label>
    {setupOwners.map((owner, index) => <fieldset className="setup-owner-fields" key={index}>
      <legend>Owner {index + 1}</legend>
      <label>Full name<input autoComplete="name" value={owner.name} onChange={(event) => updateSetupOwner(index, "name", event.target.value)} required maxLength={100} /></label>
      <label>Email address<input type="email" autoComplete="username" value={owner.email} onChange={(event) => updateSetupOwner(index, "email", event.target.value)} required maxLength={254} /></label>
      <label>Phone number<div className="phone-input-prefix"><span>+91</span><input type="tel" autoComplete="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={owner.phone} onChange={(event) => updateSetupOwner(index, "phone", event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98765 43210" required /></div></label>
      <label>Password (at least 12 characters)<PasswordInput autoComplete="new-password" value={owner.password} onChange={(event) => updateSetupOwner(index, "password", event.target.value)} required minLength={12} maxLength={256} /></label>
      <label>Confirm password<PasswordInput autoComplete="new-password" value={owner.confirmation} onChange={(event) => updateSetupOwner(index, "confirmation", event.target.value)} required minLength={12} maxLength={256} /></label>
    </fieldset>)}
    {setupError && <div className="signin-error" role="alert">{setupError}</div>}
    <button className="button button-primary signin-submit" type="submit" disabled={setupSubmitting}>{setupSubmitting ? "Setting up..." : "Create owner accounts"} <span>→</span></button>
  </form>;

  return <main className="signin-page">
    <header className="signin-nav"><Link className="brand landing-brand" to="/"><span className="brand-mark"><BuildingIcon /></span><span className="brand-copy"><strong>Vanya BuildTrack</strong><small>Construction Manager</small></span></Link><div className="signin-nav-actions"><Link to="/" className="button button-outline signin-back">← Back to home</Link></div></header>
    <section className="signin-layout">
      <div className="signin-story"><span className="landing-kicker"><i /> YOUR PROJECTS, IN SYNC</span><h1>Good work<br />starts with<br /><span>a clear view.</span></h1><p>One workspace for the people planning, building, and bringing every project to life.</p><div className="signin-story-note"><span>“</span><strong>Every site update brings the whole team closer.</strong><small>VANYA BUILDTRACK</small></div></div>
      <div className="signin-card">
        <span className="signin-card-icon"><BuildingIcon /></span>
        {setupState === "required" ? <>
          <span className="panel-kicker">FIRST-TIME WORKSPACE SETUP</span><h2>Create owner accounts</h2>
          <p className="signin-description">Use the one-time setup code from this environment's VPS logs. Choose private passwords of at least 12 characters.</p>
          {setupForm}
        </> : setupState === "checking" ? <>
          <span className="panel-kicker">WORKSPACE</span><h2>Checking setup</h2><p className="signin-description">Connecting securely to your workspace...</p>
        </> : setupState === "error" ? <>
          <span className="panel-kicker">WORKSPACE</span><h2>Unable to check setup</h2><p className="signin-error" role="alert">{setupError}</p>
          <button className="button button-primary signin-submit" type="button" onClick={() => { setSetupError(""); setSetupAttempt((attempt) => attempt + 1); }}>Try again <span>→</span></button>
        </> : <>
          <span className="panel-kicker">WELCOME BACK</span><h2>Sign in to BuildTrack</h2><p className="signin-description">Enter your email and password to open your workspace.</p>
          {notice && <div className="signin-error" role="alert">{notice}</div>}
          {setupSuccess && <div className="setup-success" role="status">{setupSuccess}</div>}
          {authChallenge ? <>
            <span className="panel-kicker">TWO-STEP VERIFICATION</span>
            <h2>{authChallenge.phoneRequired ? "Add your phone number" : "Check your phone"}</h2>
            <p className="signin-description">{authChallenge.phoneRequired
              ? "A 10-digit India mobile number is required to secure your account."
              : `Enter the verification code sent to ${authChallenge.phoneHint}.`}</p>
            {authChallenge.phoneRequired
              ? <form onSubmit={sendVerificationCode}>
                <label>Phone number<div className="phone-input-prefix"><span>+91</span><input type="tel" autoComplete="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={enrollmentPhone} onChange={(event) => setEnrollmentPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98765 43210" required /></div></label>
                {error && <div className="signin-error" role="alert">{error}</div>}
                <button className="button button-primary signin-submit" type="submit" disabled={submitting}>{submitting ? "Sending code..." : "Send verification code"} <span>→</span></button>
              </form>
              : <form onSubmit={verifyCode}>
                <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required pattern="[0-9]{4,10}" /></label>
                {error && <div className="signin-error" role="alert">{error}</div>}
                <button className="button button-primary signin-submit" type="submit" disabled={submitting}>{submitting ? "Verifying..." : "Verify and sign in"} <span>→</span></button>
                <button className="button button-outline signin-submit" type="button" disabled={submitting} onClick={() => void resendVerificationCode()}>Resend code</button>
                <button className="button button-outline signin-submit" type="button" disabled={submitting} onClick={() => { setError(""); setAuthChallenge(null); setVerificationCode(""); }}>Cancel sign-in</button>
              </form>}
          </> : <>
            <form onSubmit={signIn}>
              <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
              <label>Password<PasswordInput autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
              {error && <div className="signin-error" role="alert">{error}</div>}
              <button className="button button-primary signin-submit" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"} <span>→</span></button>
            </form>
            <p className="signin-description">Sign in to your BuildTrack workspace.</p>
          </>}
        </>}
      </div>
    </section>
    <footer className="signin-footer">© 2026 Vanya BuildTrack <span>·</span> Built for the people who build.</footer>
  </main>;
}
