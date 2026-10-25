import { useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "error">("loading");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [healthResponse, projectsResponse] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/projects")
        ]);

        if (!healthResponse.ok || !projectsResponse.ok) {
          throw new Error("The API returned an unsuccessful response");
        }

        const projectData: Project[] = await projectsResponse.json();
        setProjects(projectData);
        setApiStatus("connected");
      } catch (error) {
        console.error("Unable to load the dashboard:", error);
        setApiStatus("error");
      }
    };

    void loadDashboard();
  }, []);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Vanya BuildTrack home">
          <span className="brand-mark">V</span>
          <span>Vanya<span className="brand-light">BuildTrack</span></span>
        </a>
        <div className={`connection connection-${apiStatus}`}>
          <span className="connection-dot" />
          {apiStatus === "connected" ? "API connected" : apiStatus === "error" ? "API unavailable" : "Connecting"}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">CONCRETE PROJECT MANAGEMENT</p>
        <h1>Build with<br /><span>clarity.</span></h1>
        <p className="intro">Your site progress, project details, and next steps — all in one place.</p>
        <div className="hero-meta">
          <span className="meta-rule" />
          <span>PROJECT OVERVIEW</span>
        </div>
      </section>

      <section className="projects-section" aria-labelledby="projects-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h2 id="projects-heading">Projects <span className="project-count">{projects.length.toString().padStart(2, "0")}</span></h2>
          </div>
          <span className="section-note">TRACKING WHAT MATTERS</span>
        </div>

        {apiStatus === "error" ? (
          <div className="empty-state">
            <span className="empty-icon">!</span>
            <h3>Couldn’t connect to BuildTrack</h3>
            <p>Start the API and database, then refresh to load your projects.</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">＋</span>
            <h3>No projects yet</h3>
            <p>Your projects will appear here once they’re added.</p>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <span className="project-status">{project.status.replace(/_/g, " ")}</span>
                <h3>{project.name}</h3>
                <p>{project.description || "No description provided."}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="footer">
        <span>VANYA BUILDTRACK</span>
        <span>MADE FOR THE GROUND UP.</span>
      </footer>
    </main>
  );
}
