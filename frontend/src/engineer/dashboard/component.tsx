import type { DashboardData } from "../../common/types";
import { ExpenseRows, StatCard } from "../../common/components";

export function EngineerDashboard({ data, currentUser, onNavigate }: { data: DashboardData; currentUser: string; onNavigate: (page: string) => void }) {
  const projects = data.projects.filter((project) => project.engineer === currentUser);
  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const updatesToday = data.activities.filter((item) => item.kind === "progress" && item.actor === currentUser && item.createdAt?.startsWith(todayKey)).length;
  const pendingUpdates = Math.max(0, projects.length - updatesToday);
  const attendanceToday = data.attendance.filter((item) => item.date === todayKey).length;

  return <>
    <div className="welcome-banner"><div className="welcome-copy"><span className="panel-kicker">{dateLabel.toUpperCase()}</span><h2>Good morning, {currentUser.split(" ")[0]} <span>☀</span></h2><p>{projects.length ? "Your assigned projects and site updates are shown below." : "Your assigned projects and site updates will appear here."}</p></div></div>
    <div className="stat-grid engineer-stats">
      <StatCard label="Assigned sites" value={String(projects.length).padStart(2, "0")} note={`${projects.length} assigned projects`} icon="⌖" trend={`${projects.length} active assignments`} dark />
      <StatCard label="Avg. site progress" value={`${Math.round(projects.reduce((sum, item) => sum + item.progress, 0) / Math.max(projects.length, 1))}%`} note="Across assigned projects" icon="↗" trend={`${projects.length} projects tracked`} />
      <StatCard label="Pending updates" value={String(pendingUpdates).padStart(2, "0")} note="Based on today's progress updates" icon="◷" trend={`${updatesToday} submitted today`} attention={pendingUpdates > 0} />
      <StatCard label="Team on site" value={String(attendanceToday).padStart(2, "0")} note="Attendance records today" icon="♙" trend={`${attendanceToday} records today`} />
    </div>
    <div className="dashboard-grid engineer-grid">
      <section className="panel my-sites-panel"><div className="panel-heading compact"><div><span className="panel-kicker">YOUR ASSIGNMENTS</span><h2>My active sites</h2></div><button className="text-link" onClick={() => onNavigate("My Sites")}>All sites ↗</button></div><div className="engineer-sites">{projects.map((project) => <article className="engineer-site-card" key={project.id}><div className="site-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(33,30,28,.72), transparent 70%), url(https://images.unsplash.com/${project.image}?auto=format&fit=crop&w=700&q=80)` }}><span className="site-id">{project.id}</span><span className="site-status"><i /> {project.status}</span></div><div className="engineer-site-body"><div className="site-title-row"><div><h3>{project.name}</h3><span>⌖ {project.site}</span></div><button className="icon-button" aria-label={`Open ${project.name}`} onClick={() => onNavigate("My Sites")}>↗</button></div><div className="progress-label"><span>Overall progress</span><strong>{project.progress}%</strong></div><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div><div className="site-task-row"><span>Next milestone</span><strong>{project.dueDate}</strong></div></div></article>)}</div>{!projects.length && <div className="inline-empty">No projects are assigned to your account yet.</div>}</section>
    </div>
    <div className="bottom-grid engineer-bottom-grid"><section className="panel table-panel"><div className="panel-heading compact"><div><span className="panel-kicker">YOUR SUBMISSIONS</span><h2>Recent expenses</h2></div><button className="text-link" onClick={() => onNavigate("Expenses")}>History ↗</button></div><ExpenseRows expenses={data.expenses.filter((item) => item.submittedBy === currentUser).slice(0, 3)} /></section></div>
  </>;
}
