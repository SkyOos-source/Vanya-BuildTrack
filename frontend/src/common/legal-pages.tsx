import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BuildingIcon } from "./components";

function LegalLayout({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return <main className="legal-page">
    <header className="landing-nav">
      <Link className="brand landing-brand" to="/"><span className="brand-mark"><BuildingIcon /></span><span className="brand-copy"><strong>BuildTrack</strong><small>Construction Manager</small></span></Link>
      <Link className="button button-outline" to="/">Home</Link>
    </header>
    <article className="legal-content">
      <span className="panel-kicker">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated: 27 October 2026</p>
      {children}
    </article>
    <footer className="landing-footer"><span>© 2026 Vanya BuildTrack</span><Link to="/data-usage">Data Usage</Link></footer>
  </main>;
}

export function PrivacyPolicyPage() {
  return <LegalLayout title="Privacy Policy" eyebrow="YOUR PRIVACY">
    <p>BuildTrack helps construction teams manage projects, site activity, and communication. This page describes the information handled by this demo application and how it is used.</p>
    <h2>Information in the workspace</h2>
    <p>Workspace records may include project and site details, budgets, quotations, material and expense records, team member names and email addresses, client feedback, and site visit schedules.</p>
    <p>When an engineer records attendance, the app may collect a check-in or check-out photo and the device’s location coordinates, if the user grants location access. These details are attached to the attendance record.</p>
    <h2>How information is used</h2>
    <p>Information is used to display the workspace features: project progress, assignments, financial records, attendance, and updates to the relevant workspace roles. The app does not use this information for advertising.</p>
    <h2>Storage and access</h2>
    <p>This starter demo stores workspace data in a local JSON file on the backend and stores the demo sign-in session in browser local storage. This is not a production security or multi-user data setup. Anyone with access to the demo environment or its data file may be able to access workspace records.</p>
    <h2>Retention and questions</h2>
    <p>Workspace data remains in the configured data file until it is changed or removed by the workspace operator. For requests about records or this demo, contact the administrator who provided access.</p>
    <p>This sample policy is informational and should be reviewed and adapted by the organization before production use.</p>
  </LegalLayout>;
}

export function DataUsagePage() {
  return <LegalLayout title="Data Usage" eyebrow="HOW BUILDTRACK USES DATA">
    <p>BuildTrack uses information submitted to the workspace to provide project management features. This demo is intended for sample data and evaluation, not sensitive or production records.</p>
    <h2>Workspace data</h2>
    <ul>
      <li><strong>Projects:</strong> project names, locations, assigned engineers, status, budget, and progress.</li>
      <li><strong>People:</strong> names, email addresses, roles, and project assignments.</li>
      <li><strong>Project activity:</strong> quotations and uploaded quotation PDFs, expenses, materials, progress updates, site visits, and feedback.</li>
      <li><strong>Attendance:</strong> check-in and check-out timestamps, photos, and location coordinates when attendance is submitted.</li>
    </ul>
    <h2>What happens to the data</h2>
    <p>The frontend requests workspace records from the app API. In the demo setup, the backend persists records in a local JSON file. Uploaded attachments are stored with their related records. Demo sign-in uses sample credentials and a session value in browser local storage; it is not production authentication.</p>
    <h2>Use and sharing</h2>
    <p>Data is displayed to support the selected workspace role and related project workflows. The demo has no advertising or analytics integration. Do not enter real personal, financial, or confidential information into a publicly accessible demo.</p>
    <h2>Managing records</h2>
    <p>Workspace operators can manage records through the app and its configured data store. Contact the workspace administrator for access, correction, or deletion requests.</p>
  </LegalLayout>;
}

export function NotFoundPage() {
  return <main className="not-found-page">
    <Link className="brand landing-brand" to="/"><span className="brand-mark"><BuildingIcon /></span><span className="brand-copy"><strong>BuildTrack</strong><small>Construction Manager</small></span></Link>
    <section>
      <span className="not-found-code">404</span>
      <h1>Page not found</h1>
      <p>The page may have moved, or the address may be incorrect.</p>
      <div><Link className="button button-primary" to="/">Go to home</Link><Link className="button button-outline" to="/signin">Sign in</Link></div>
    </section>
  </main>;
}
