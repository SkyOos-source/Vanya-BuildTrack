import type { DashboardData, Project, RecordModalType } from "../../common/types";
import { formatCurrency } from "../../common/utils";
import { ExpenseRows, ProjectCards, StatCard } from "../../common/components";
import { isDemoMode } from "../../common/data";

export function OwnerDashboard({ data, onNavigate, onCreate, onOpenProject }: { data: DashboardData; onNavigate: (page: string) => void; onCreate: (modal: RecordModalType | null) => void; onOpenProject: (project: Project) => void }) {
  const totalBudget = data.projects.reduce((sum, item) => sum + item.budget, 0);
  const totalSpent = data.projects.reduce((sum, item) => sum + item.spent, 0);
  const pendingExpenses = data.expenses.filter((item) => item.status === "Pending review").length;
  const activeSites = data.projects.filter((item) => item.status !== "Completed" && item.status !== "Cancelled").length;
  const demoMode = isDemoMode();
  const utilization = totalBudget ? Math.round(totalSpent / totalBudget * 100) : 0;
  const chart = [{ month: "May", revenue: 238, expenses: 176 }, { month: "Jun", revenue: 302, expenses: 211 }, { month: "Jul", revenue: 274, expenses: 229 }, { month: "Aug", revenue: 390, expenses: 281 }, { month: "Sep", revenue: 342, expenses: 263 }, { month: "Oct", revenue: 486, expenses: 334 }];
  return <>
    <div className="stat-grid">
      <article className="stat-card budget-card"><div className="budget-top"><div><span className="stat-label">Total project budget</span><strong>{formatCurrency(totalBudget)}</strong><small>Across {activeSites} active projects</small></div><div className="budget-revenue"><span>Utilized</span><strong>{utilization}%</strong><small>{formatCurrency(totalSpent)} spent</small></div></div><div className="budget-track"><span style={{ width: `${utilization}%` }} /></div><div className="budget-foot"><span><i className="legend-orange" /> Spent</span><span>{formatCurrency(totalBudget - totalSpent)} remaining</span></div></article>
      <StatCard label="Active projects" value={String(activeSites).padStart(2, "0")} note="Across your portfolio" icon="▦" trend={`${data.projects.length} total projects`} />
      <StatCard label="Active sites" value={String(activeSites).padStart(2, "0")} note="Not completed or cancelled" icon="⌖" trend={`${activeSites} active sites`} />
      <StatCard label="Needs your review" value={String(pendingExpenses + data.quotes.filter((item) => item.status === "Awaiting review").length).padStart(2, "0")} note="Expenses & quotations" icon="◷" trend={`${pendingExpenses} pending expenses`} attention />
    </div>
    <div className="dashboard-grid">
      {demoMode ? <section className="panel chart-panel">
        <div className="panel-heading"><div><span className="panel-kicker">FINANCIAL OVERVIEW</span><h2>Revenue vs expenses</h2><p>Portfolio performance over the last 6 months</p></div><button className="select-button">Last 6 months <span>⌄</span></button></div>
        <div className="chart-legend"><span><i className="legend-orange" /> Revenue</span><span><i className="legend-charcoal" /> Expenses</span><span className="chart-total">INR · thousands</span></div>
        <div className="chart" role="img" aria-label="Bar chart comparing monthly revenue and expenses from May to October">
          <div className="chart-y"><span>500</span><span>375</span><span>250</span><span>125</span><span>0</span></div>
          <div className="chart-plot"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><div className="bar-groups">{chart.map((month) => <div className="bar-group" key={month.month}><div className="bars"><span className="bar revenue-bar" style={{ height: `${month.revenue / 5}%` }} title={`Revenue ${month.revenue}k`} /><span className="bar expense-bar" style={{ height: `${month.expenses / 5}%` }} title={`Expenses ${month.expenses}k`} /></div><span className="bar-month">{month.month}</span></div>)}</div></div>
        </div>
      </section> : <section className="panel chart-panel"><div className="panel-heading"><div><span className="panel-kicker">FINANCIAL OVERVIEW</span><h2>Revenue vs expenses</h2></div></div><div className="inline-empty">Monthly financial history will appear when it is available in your workspace.</div></section>}
      <section className="panel activity-panel"><div className="panel-heading compact"><div><span className="panel-kicker">LIVE FROM YOUR SITES</span><h2>Recent activity</h2></div><button className="text-link" onClick={() => onNavigate("Reports")}>View all ↗</button></div><div className="activity-list">{data.activities.slice(0, 5).map((item) => <div className="activity-item" key={item.id}><span className={`activity-icon activity-${item.kind}`}>{item.kind === "progress" ? "↗" : item.kind === "expense" ? "＄" : item.kind === "quote" ? "▤" : item.kind === "attendance" ? "◷" : "◈"}</span><div className="activity-copy"><p><strong>{item.actor}</strong> {item.action}</p><span>{item.project}</span></div><time>{item.time}</time></div>)}</div></section>
    </div>
    <section className="panel project-panel"><div className="panel-heading compact"><div><span className="panel-kicker">YOUR PORTFOLIO</span><h2>Active projects <span className="heading-count">{data.projects.length}</span></h2></div><button className="text-link" onClick={() => onNavigate("Projects & Sites")}>All projects ↗</button></div><ProjectCards projects={data.projects.slice(0, 3)} onOpen={onOpenProject} /></section>
    <div className="bottom-grid"><section className="panel table-panel"><div className="panel-heading compact"><div><span className="panel-kicker">ACTION REQUIRED</span><h2>Expenses for review</h2></div><button className="text-link" onClick={() => onNavigate("Expenses")}>All expenses ↗</button></div><ExpenseRows expenses={data.expenses.slice(0, 3)} /></section><section className="panel visit-panel"><div className="panel-heading compact"><div><span className="panel-kicker">COMING UP</span><h2>Site visits</h2></div><button className="icon-button small-add" aria-label="Schedule site visit" onClick={() => onCreate("visit")}>＋</button></div><div className="visit-list">{data.siteVisits.slice(0, 2).map((visit) => <div className="visit-item" key={visit.id}><div className="visit-date"><strong>{visit.date.split(" ")[0]}</strong><span>{visit.date.split(" ")[1]?.slice(0, 3).toUpperCase()}</span></div><div className="visit-info"><strong>{visit.project}</strong><span>{visit.site} · {visit.engineer}</span></div><time>{visit.time}</time></div>)}</div><button className="visit-add" onClick={() => onCreate("visit")}>＋ Schedule a site visit</button></section></div>
    <button className="floating-demo-action" onClick={() => onCreate("quote")}><span>＋</span> Create quotation</button>
  </>;
}
