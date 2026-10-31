import { useState } from "react";
import type { DashboardData, Project } from "../../common/types";
import { formatCurrency } from "../../common/utils";

type ProjectFinancials = { project: Project; revenue: number; expenditure: number; profit: number };

export default function OwnerFinancialReport({ data, onBack }: { data: DashboardData; onBack: () => void }) {
  const [projectFilter, setProjectFilter] = useState("All");
  const [periodFilter, setPeriodFilter] = useState("All");
  const isWithinPeriod = (value: string) => {
    if (periodFilter === "All") return true;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - Number(periodFilter));
    return date >= cutoff && date <= now;
  };
  const filteredQuotes = data.quotes.filter((quote) =>
    (projectFilter === "All" || quote.project === projectFilter) && isWithinPeriod(quote.date)
  );
  const filteredExpenses = data.expenses.filter((expense) =>
    (projectFilter === "All" || expense.project === projectFilter) && isWithinPeriod(expense.date)
  );
  const projectFinancials: ProjectFinancials[] = data.projects.map((project) => {
    const quotes = filteredQuotes.filter((quote) => quote.project === project.name);
    const hasQuotes = data.quotes.some((quote) => quote.project === project.name);
    const revenue = quotes.length
      ? quotes.reduce((total, quote) => total + quote.amount, 0)
      : !hasQuotes && periodFilter === "All" ? project.quotationAmount ?? 0 : 0;
    const expenditure = filteredExpenses
      .filter((expense) => expense.project === project.name)
      .reduce((total, expense) => total + expense.amount, 0);
    return { project, revenue, expenditure, profit: revenue - expenditure };
  }).filter(({ project }) => projectFilter === "All" || project.name === projectFilter);
  const chartMax = Math.max(0, ...projectFinancials.flatMap((item) => [item.revenue, item.expenditure])) / 1000;
  const chartAxisMax = chartMax > 0 ? Math.ceil(chartMax / 4) * 4 : 4;
  const chartAxisLabels = Array.from({ length: 5 }, (_, index) => Math.round(chartAxisMax * (4 - index) / 4));
  const maxAbsoluteProfit = Math.max(0, ...projectFinancials.map((item) => Math.abs(item.profit)));

  return <div className="financial-report">
    <section className="panel feature-panel financial-report-panel">
      <div className="list-toolbar">
        <div><span className="panel-kicker">PROJECT PERFORMANCE</span><h2 className="list-title">Revenue vs expenses by project</h2></div>
        <div className="toolbar-actions">
          <select className="select-button" aria-label="Filter financial report by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="All">All projects</option>
            {data.projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
          </select>
          <select className="select-button" aria-label="Filter financial report by period" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
            <option value="All">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
          </select>
          <button className="button button-outline" onClick={onBack}>← Dashboard</button>
        </div>
      </div>
      {projectFinancials.length ? <div className="financial-report-charts">
        <section className="financial-report-chart-panel">
          <div className="financial-report-chart-heading"><div><h3>Revenue vs expenditure</h3><p>Project totals · INR thousands</p></div><div className="chart-legend"><span><i className="legend-orange" /> Revenue</span><span><i className="legend-charcoal" /> Expenditure</span></div></div>
          <div className="financial-chart-scroll">
            <div className="chart financial-report-bar-chart" style={{ width: `${Math.max(projectFinancials.length * 100, 520)}px` }} role="img" aria-label={`Revenue and expenditure for ${projectFinancials.map((item) => item.project.name).join(", ")}`}>
              <div className="chart-y">{chartAxisLabels.map((label, index) => <span key={index}>{label}</span>)}</div>
              <div className="chart-plot"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><div className="bar-groups" style={{ gridTemplateColumns: `repeat(${projectFinancials.length}, minmax(0, 1fr))` }}>
                {projectFinancials.map((item) => <div className="bar-group" key={item.project.id}><div className="bars">
                  <span className="bar revenue-bar" style={{ height: `${item.revenue / 1000 / chartAxisMax * 100}%` }} data-tooltip={`Revenue · ${formatCurrency(item.revenue)}`} />
                  <span className="bar expense-bar" style={{ height: `${item.expenditure / 1000 / chartAxisMax * 100}%` }} data-tooltip={`Expenditure · ${formatCurrency(item.expenditure)}`} />
                </div><span className="bar-month" title={item.project.name}>{item.project.name}</span></div>)}
              </div></div>
            </div>
          </div>
        </section>
        <section className="financial-report-chart-panel">
          <div className="financial-report-chart-heading"><div><h3>Profit by project</h3><p>Revenue less expenditure</p></div></div>
          {maxAbsoluteProfit > 0 ? <div className="financial-profit-chart">{projectFinancials.map((item) => <div className="financial-profit-row" key={item.project.id}>
            <span title={item.project.name}>{item.project.name}</span><div className="financial-profit-track"><i className={item.profit < 0 ? "financial-profit-negative" : ""} style={{ width: `${Math.abs(item.profit) / maxAbsoluteProfit * 100}%` }} /></div><strong className={item.profit < 0 ? "financial-loss" : ""}>{formatCurrency(item.profit)}</strong>
          </div>)}</div> : <div className="inline-empty financial-profit-empty">Profit data will appear when revenue or expenditure is recorded.</div>}
        </section>
      </div> : null}
      {projectFinancials.length ? <div className="financial-report-table-wrap"><table className="financial-report-table">
        <thead><tr><th>Project</th><th>Quotations</th><th>Revenue</th><th>Expenses</th><th>Expenditure</th><th>Profit</th></tr></thead>
        <tbody>{projectFinancials.map(({ project, revenue, expenditure, profit }) => <tr key={project.id}>
          <td><strong>{project.name}</strong><small>{project.site}</small></td>
          <td>{filteredQuotes.filter((quote) => quote.project === project.name).length}</td>
          <td>{formatCurrency(revenue)}</td>
          <td>{filteredExpenses.filter((expense) => expense.project === project.name).length}</td>
          <td>{formatCurrency(expenditure)}</td>
          <td className={profit < 0 ? "financial-loss" : ""}>{formatCurrency(profit)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="inline-empty">No project financial data is available yet.</div>}
    </section>
  </div>;
}
