import type { DashboardData, Project, RecordModalType } from "../../common/types";
import { formatCurrency, siteVisitDateParts } from "../../common/utils";
import { ExpenseRows, ProjectCards, StatCard } from "../../common/components";

export function OwnerDashboard({ data, onNavigate, onCreate, onOpenProject }: { data: DashboardData; onNavigate: (page: string) => void; onCreate: (modal: RecordModalType | null) => void; onOpenProject: (project: Project) => void }) {
  const pendingExpenses = data.expenses.filter((item) => item.status === "Pending review").length;
  const activeSites = data.projects.filter((item) => item.status !== "Completed" && item.status !== "Cancelled").length;
  const totalRevenue = data.projects.reduce((total, project) => {
    const projectQuotes = data.quotes.filter((quote) => quote.project === project.name);
    return total + (projectQuotes.length
      ? projectQuotes.reduce((quoteTotal, quote) => quoteTotal + quote.amount, 0)
      : project.quotationAmount ?? 0);
  }, 0);
  const totalExpenditure = data.expenses.reduce((total, expense) => total + expense.amount, 0);
  const profit = totalRevenue - totalExpenditure;
  const expenditureRatio = totalRevenue > 0 ? Math.min(Math.max(totalExpenditure / totalRevenue * 100, 0), 100) : 0;
  const chart = data.projects.map((project) => {
    const projectQuotes = data.quotes.filter((quote) => quote.project === project.name);
    return {
      project: project.name,
      revenue: (projectQuotes.length
        ? projectQuotes.reduce((total, quote) => total + quote.amount, 0)
        : project.quotationAmount ?? 0) / 1000,
      expenses: data.expenses
        .filter((expense) => expense.project === project.name)
        .reduce((total, expense) => total + expense.amount, 0) / 1000
    };
  });
  const chartMax = Math.max(0, ...chart.flatMap((item) => [item.revenue, item.expenses]));
  const chartAxisMax = chartMax > 0 ? Math.ceil(chartMax / 4) * 4 : 4;
  const chartAxisLabels = Array.from({ length: 5 }, (_, index) => Math.round(chartAxisMax * (4 - index) / 4));
  return <>
    <div className="stat-grid owner-stat-grid">
      <article className="financial-summary-card">
        <div className="financial-summary-top">
          <div><span>Total revenue</span><strong>{formatCurrency(totalRevenue)}</strong><small>Across {data.projects.length} active projects</small></div>
          <div className="financial-summary-profit"><span>Profit</span><strong>{formatCurrency(profit)}</strong><small>Revenue less expenditure</small></div>
        </div>
        <div className="financial-summary-track" role="progressbar" aria-label="Expenditure as a share of revenue" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(expenditureRatio)}><span style={{ width: `${expenditureRatio}%` }} /></div>
        <div className="financial-summary-foot"><span><i /> Expenditure</span><strong>{formatCurrency(totalExpenditure)}</strong></div>
      </article>
      <StatCard label="Active projects" value={String(activeSites).padStart(2, "0")} note="Across your portfolio" icon="▦" trend={`${data.projects.length} total projects`} />
      <StatCard label="Active sites" value={String(activeSites).padStart(2, "0")} note="Not completed or cancelled" icon="⌖" trend={`${activeSites} active sites`} />
      <StatCard label="Needs your review" value={String(pendingExpenses + data.quotes.filter((item) => item.status === "Awaiting review").length).padStart(2, "0")} note="Expenses & quotations" icon="◷" trend={`${pendingExpenses} pending expenses`} attention />
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span className="panel-kicker">FINANCIAL OVERVIEW</span><h2>Revenue vs expenses</h2><p>Project quotation vs recorded expenses</p></div><button className="text-link" onClick={() => onNavigate("Financial Overview")}>View all ↗</button></div>
        {chart.length ? <>
          <div className="chart-legend"><span><i className="legend-orange" /> Revenue</span><span><i className="legend-charcoal" /> Expenses</span><span className="chart-total">INR · thousands</span></div>
          <div className="chart" role="img" aria-label={`Bar chart comparing revenue and expenses for ${chart.map((item) => item.project).join(", ")}`}>
            <div className="chart-y">{chartAxisLabels.map((label, index) => <span key={index}>{label}</span>)}</div>
            <div className="chart-plot"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><div className="bar-groups" style={{ gridTemplateColumns: `repeat(${chart.length}, minmax(0, 1fr))` }}>{chart.map((item) => <div className="bar-group" key={item.project}><div className="bars"><span className="bar revenue-bar" style={{ height: `${item.revenue / chartAxisMax * 100}%` }} data-tooltip={`Revenue · ${formatCurrency(item.revenue * 1000)}`} /><span className="bar expense-bar" style={{ height: `${item.expenses / chartAxisMax * 100}%` }} data-tooltip={`Expenses · ${formatCurrency(item.expenses * 1000)}`} /></div><span className="bar-month" title={item.project}>{item.project}</span></div>)}</div></div>
          </div>
        </> : <div className="inline-empty">Project financial data will appear when it is available in your workspace.</div>}
      </section>
      <section className="panel activity-panel"><div className="panel-heading compact"><div><span className="panel-kicker">LIVE FROM YOUR SITES</span><h2>Recent activity</h2></div><button className="text-link" onClick={() => onNavigate("Reports")}>View all ↗</button></div><div className="activity-list">{data.activities.slice(0, 5).map((item) => <div className="activity-item" key={item.id}><span className={`activity-icon activity-${item.kind}`}>{item.kind === "progress" ? "↗" : item.kind === "expense" ? "＄" : item.kind === "quote" ? "▤" : item.kind === "attendance" ? "◷" : "◈"}</span><div className="activity-copy"><p><strong>{item.actor}</strong> {item.action}</p><span>{item.project}</span></div><time>{item.time}</time></div>)}</div></section>
    </div>
    <section className="panel project-panel"><div className="panel-heading compact"><div><span className="panel-kicker">YOUR PORTFOLIO</span><h2>Active projects <span className="heading-count">{data.projects.length}</span></h2></div><button className="text-link" onClick={() => onNavigate("Projects & Sites")}>All projects ↗</button></div><ProjectCards projects={data.projects.slice(0, 3)} onOpen={onOpenProject} /></section>
    <div className="bottom-grid"><section className="panel table-panel"><div className="panel-heading compact"><div><span className="panel-kicker">ACTION REQUIRED</span><h2>Expenses for review</h2></div><button className="text-link" onClick={() => onNavigate("Expenses")}>All expenses ↗</button></div><ExpenseRows expenses={data.expenses.slice(0, 3)} /></section><section className="panel visit-panel"><div className="panel-heading compact"><div><span className="panel-kicker">COMING UP</span><h2>Site visits</h2></div><button className="icon-button small-add" aria-label="Schedule site visit" onClick={() => onCreate("visit")}>＋</button></div><div className="visit-list">{data.siteVisits.filter((visit) => visit.status === "Scheduled" || visit.status === "Checked in").slice(0, 2).map((visit) => { const date = siteVisitDateParts(visit.date); return <div className="visit-item" key={visit.id}><div className="visit-date"><strong>{date.day}</strong><span>{date.month}</span></div><div className="visit-info"><strong>{visit.project}</strong><span>{visit.site} · {visit.engineer}</span></div></div>; })}</div><button className="visit-add" onClick={() => onCreate("visit")}>＋ Schedule a site visit</button></section></div>
    <button className="floating-demo-action" onClick={() => onCreate("quote")}><span>＋</span> Create quotation</button>
  </>;
}
