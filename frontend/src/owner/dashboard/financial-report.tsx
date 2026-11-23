import { useMemo, useState } from "react";
import type { DashboardData, Project } from "../../common/types";
import { formatCurrency, formatMonthLabel, isLoggedExpense, monthKeyForDate } from "../../common/utils";

type ProjectFinancials = { project: Project; quotations: number; payments: number; revenue: number; expenses: number; expenditure: number; profit: number };
type ProjectFinancialTotals = Omit<ProjectFinancials, "project" | "profit">;

export default function OwnerFinancialReport({ data, selectedMonth, onMonthChange, onBack }: { data: DashboardData; selectedMonth: string; onMonthChange: (month: string) => void; onBack: () => void }) {
  const [projectFilter, setProjectFilter] = useState("All");
  const projectFinancials = useMemo(() => {
    const totals = new Map<string, ProjectFinancialTotals>();
    for (const project of data.projects) {
      totals.set(project.name, { quotations: 0, payments: 0, revenue: 0, expenses: 0, expenditure: 0 });
    }
    for (const quote of data.quotes) {
      if (monthKeyForDate(quote.date) !== selectedMonth) continue;
      const total = totals.get(quote.project);
      if (total) total.quotations += 1;
    }
    for (const payment of data.payments) {
      if (monthKeyForDate(payment.date) !== selectedMonth) continue;
      const total = totals.get(payment.project);
      if (total) {
        total.payments += 1;
        total.revenue += payment.amount;
      }
    }
    for (const expense of data.expenses) {
      if (!isLoggedExpense(expense) || monthKeyForDate(expense.date) !== selectedMonth) continue;
      const total = totals.get(expense.project);
      if (total) {
        total.expenses += 1;
        total.expenditure += expense.amount;
      }
    }
    return data.projects
      .filter((project) => projectFilter === "All" || project.name === projectFilter)
      .map((project) => {
        const total = totals.get(project.name);
        const revenue = total?.revenue ?? 0;
        const expenditure = total?.expenditure ?? 0;
        return {
          project,
          quotations: total?.quotations ?? 0,
          payments: total?.payments ?? 0,
          revenue,
          expenses: total?.expenses ?? 0,
          expenditure,
          profit: revenue - expenditure
        };
      });
  }, [data.projects, data.quotes, data.payments, data.expenses, selectedMonth, projectFilter]);
  const totalRevenue = projectFinancials.reduce((total, item) => total + item.revenue, 0);
  const totalExpenditure = projectFinancials.reduce((total, item) => total + item.expenditure, 0);
  const totalPayments = projectFinancials.reduce((total, item) => total + item.payments, 0);
  const totalExpenses = projectFinancials.reduce((total, item) => total + item.expenses, 0);
  const totalProfit = totalRevenue - totalExpenditure;
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
          <input className="select-button" type="month" aria-label="Filter financial report by month" value={selectedMonth} onChange={(event) => onMonthChange(event.target.value)} />
          <button className="button button-outline" onClick={onBack}>← Dashboard</button>
        </div>
      </div>
      <section className="payment-summary-grid" aria-label={`Financial totals for ${formatMonthLabel(selectedMonth)}`}>
        <article className="payment-summary-stat"><span>Revenue received</span><strong>{formatCurrency(totalRevenue)}</strong><small>{totalPayments} payments · {formatMonthLabel(selectedMonth)}</small></article>
        <article className="payment-summary-stat"><span>Expenses logged</span><strong>{formatCurrency(totalExpenditure)}</strong><small>{totalExpenses} records · {formatMonthLabel(selectedMonth)}</small></article>
        <article className="payment-summary-stat"><span>Profit / loss</span><strong className={totalProfit < 0 ? "financial-loss" : ""}>{formatCurrency(totalProfit)}</strong><small>Revenue less expenses</small></article>
      </section>
      {projectFinancials.length ? <div className="financial-report-charts">
        <section className="financial-report-chart-panel">
          <div className="financial-report-chart-heading"><div><h3>Payments received vs expenses</h3><p>{formatMonthLabel(selectedMonth)} project totals · INR thousands</p></div><div className="chart-legend"><span><i className="legend-orange" /> Revenue</span><span><i className="legend-charcoal" /> Expenditure</span></div></div>
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
        <thead><tr><th>Project</th><th>Quotations</th><th>Payments</th><th>Revenue received</th><th>Expenses</th><th>Expenditure</th><th>Profit / loss</th></tr></thead>
        <tbody>{projectFinancials.map(({ project, quotations, payments, revenue, expenses, expenditure, profit }) => <tr key={project.id}>
          <td><strong>{project.name}</strong><small>{project.site}</small></td>
          <td>{quotations}</td>
          <td>{payments}</td>
          <td>{formatCurrency(revenue)}</td>
          <td>{expenses}</td>
          <td>{formatCurrency(expenditure)}</td>
          <td className={profit < 0 ? "financial-loss" : ""}>{formatCurrency(profit)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="inline-empty">No project financial data is available yet.</div>}
    </section>
  </div>;
}
