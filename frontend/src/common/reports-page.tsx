import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "./api";
import { currentMonthKey, formatCurrency, formatMonthLabel, withRetryGuidance } from "./utils";

type ReportType = "progress" | "expenses" | "materials";
type QuantitySummary = { material: string; quantity: number; unit: string };
type ReportRecord = {
  id?: string;
  name?: string;
  site?: string;
  project?: string;
  status?: string;
  stage?: string;
  progress?: number;
  updates?: ReportRecord[];
  description?: string;
  action?: string;
  createdAt?: string;
  date?: string;
  loggedAt?: string;
  recordType?: string;
  amount?: number;
  method?: string;
  recordedBy?: string;
  submittedBy?: string;
  note?: string;
  material?: string;
  category?: string;
  stock?: string;
  received?: string;
  used?: string;
  quantity?: number;
  unit?: string;
  engineer?: string;
  assignedAt?: string;
  lastUpdated?: string;
};
type MonthlyReport = {
  generatedAt: string;
  month: string;
  type: ReportType;
  records: ReportRecord[];
  summary: {
    siteCount?: number;
    averageProgress?: number;
    updatesCount?: number;
    totalExpenses?: number;
    cashIn?: number;
    cashOut?: number;
    cashPayments?: number;
    onlinePayments?: number;
    currentStock?: QuantitySummary[];
    used?: QuantitySummary[];
  };
};

const reportCards: Array<{ type: ReportType; icon: string; kicker: string; title: string; description: string }> = [
  { type: "progress", icon: "▥", kicker: "PROJECT PERFORMANCE", title: "Progress report", description: "Current progress for every site, with updates submitted during the selected month." },
  { type: "expenses", icon: "＄", kicker: "FINANCIAL HEALTH", title: "Expense report", description: "Logged or paid expenses as cash out, and recorded client payments as cash in." },
  { type: "materials", icon: "◈", kicker: "SITE INVENTORY", title: "Materials report", description: "Current stock on hand and material used during the selected month." }
];

function isReportType(value: string | null): value is ReportType {
  return value === "progress" || value === "expenses" || value === "materials";
}

function isMonthValue(value: string | null): value is string {
  const match = value && /^(\d{4})-(\d{2})$/.exec(value);
  return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
}

function recordText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function recordNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function quantityLabel(item: QuantitySummary) {
  return `${item.quantity} ${item.unit}`.trim();
}

function ReportSummary({ report, records, materialFilter }: { report: MonthlyReport; records: ReportRecord[]; materialFilter: string }) {
  if (report.type === "progress") {
    const averageProgress = records.length
      ? Math.round(records.reduce((total, record) => total + recordNumber(record.progress), 0) / records.length)
      : 0;
    const updatesCount = records.reduce((total, record) => total + (record.updates?.length ?? 0), 0);
    return <section className="monthly-report-kpis" aria-label="Progress report totals">
      <article><span>Sites</span><strong>{records.length}</strong></article>
      <article><span>Average progress</span><strong>{averageProgress}%</strong></article>
      <article><span>Monthly updates</span><strong>{updatesCount}</strong></article>
    </section>;
  }
  if (report.type === "expenses") {
    const expenses = records.filter((record) => record.recordType === "expense");
    const payments = records.filter((record) => record.recordType === "payment");
    const cashOut = expenses.reduce((total, record) => total + recordNumber(record.amount), 0);
    const cashIn = payments.reduce((total, record) => total + recordNumber(record.amount), 0);
    const cashPayments = payments.filter((record) => record.method === "Cash")
      .reduce((total, record) => total + recordNumber(record.amount), 0);
    const onlinePayments = payments.filter((record) => record.method === "Online")
      .reduce((total, record) => total + recordNumber(record.amount), 0);
    return <section className="monthly-report-kpis" aria-label="Expense report totals">
      <article><span>Total expenses / cash out</span><strong>{formatCurrency(cashOut)}</strong></article>
      <article><span>Payments / cash in</span><strong>{formatCurrency(cashIn)}</strong><small>Cash {formatCurrency(cashPayments)} · Online {formatCurrency(onlinePayments)}</small></article>
      <article><span>Net cash flow</span><strong>{formatCurrency(cashIn - cashOut)}</strong></article>
    </section>;
  }
  const currentStock = report.summary.currentStock?.filter((item) => materialFilter === "All" || item.material === materialFilter) ?? [];
  const used = new Map<string, QuantitySummary>();
  for (const record of records.filter((item) => item.recordType === "usage")) {
    const key = `${record.material}|${record.unit}`;
    const total = used.get(key);
    if (total) total.quantity += recordNumber(record.quantity);
    else used.set(key, { material: recordText(record.material), unit: recordText(record.unit), quantity: recordNumber(record.quantity) });
  }
  const usedQuantities = Array.from(used.values());
  return <section className="monthly-report-material-totals" aria-label="Material report totals">
    <article className="panel"><div><span className="panel-kicker">CURRENT STOCK ON HAND</span><h3>Material in</h3></div>
      {currentStock.length
        ? <ul>{currentStock.map((item) => <li key={`${item.material}-${item.unit}`}><span>{item.material}</span><strong>{quantityLabel(item)}</strong></li>)}</ul>
        : <p className="people-empty">No stock currently recorded.</p>}
    </article>
    <article className="panel"><div><span className="panel-kicker">SELECTED MONTH</span><h3>Material used</h3></div>
      {usedQuantities.length
        ? <ul>{usedQuantities.map((item) => <li key={`${item.material}-${item.unit}`}><span>{item.material}</span><strong>{quantityLabel(item)}</strong></li>)}
          </ul>
        : <p className="people-empty">No material use recorded this month.</p>}
    </article>
  </section>;
}

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState(() => isMonthValue(searchParams.get("month")) ? searchParams.get("month")! : currentMonthKey());
  const reportType = isReportType(searchParams.get("report")) ? searchParams.get("report") : null;
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [projectFilter, setProjectFilter] = useState("All");
  const [recordTypeFilter, setRecordTypeFilter] = useState("All");
  const [materialFilter, setMaterialFilter] = useState("All");

  const updateMonth = (nextMonth: string) => {
    if (!isMonthValue(nextMonth)) return;
    setMonth(nextMonth);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("month", nextMonth);
    setSearchParams(nextParams, { replace: true });
  };
  const openReport = (type: ReportType) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("report", type);
    nextParams.set("month", month);
    setSearchParams(nextParams);
  };
  const closeReport = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("report");
    setSearchParams(nextParams);
    setReport(null);
  };

  useEffect(() => {
    if (!reportType) return;
    let active = true;
    setLoading(true);
    setError("");
    setReport(null);
    const loadReport = async () => {
      try {
        const response = await apiFetch(`/api/reports/${reportType}?month=${encodeURIComponent(month)}`);
        const result = await response.json() as MonthlyReport & { error?: string };
        if (!response.ok) throw new Error(result.error || `Report request failed (${response.status})`);
        if (!active) return;
        setReport(result);
      } catch (loadError) {
        if (!active) return;
        console.error(`Unable to load ${reportType} report:`, loadError);
        setError(withRetryGuidance(loadError instanceof Error ? loadError.message : "Could not load this report."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReport();
    return () => { active = false; };
  }, [reportType, month, retry]);

  const projectOptions = useMemo(() => Array.from(new Set((report?.records ?? [])
    .map((record) => record.project || record.name || "")
    .filter(Boolean))), [report]);
  const materialOptions = useMemo(() => Array.from(new Set((report?.records ?? [])
    .filter((record) => record.recordType === "inventory" || record.recordType === "usage")
    .map((record) => record.material || "")
    .filter(Boolean))), [report]);
  const filteredRecords = (report?.records ?? []).filter((record) => {
    const projectName = record.project || record.name || "";
    if (projectFilter !== "All" && projectName !== projectFilter &&
      !(reportType === "materials" && record.recordType === "inventory")) return false;
    if (recordTypeFilter !== "All" && record.recordType !== recordTypeFilter) return false;
    if (materialFilter !== "All" && record.material !== materialFilter) return false;
    return true;
  });
  const activeCard = reportCards.find((card) => card.type === reportType);

  if (!reportType) {
    return <>
      <p className="reports-month-note">Reports default to the current month. Choose a different month inside a report.</p>
      <section className="report-grid">
        {reportCards.map((card) => <article className="report-card panel" key={card.type}>
          <span className="report-icon">{card.icon}</span><span className="panel-kicker">{card.kicker}</span>
          <h2>{card.title}</h2><p>{card.description}</p>
          <button className="text-link" type="button" onClick={() => {
            setProjectFilter("All");
            setRecordTypeFilter("All");
            setMaterialFilter("All");
            openReport(card.type);
          }}>View report ↗</button>
        </article>)}
      </section>
    </>;
  }

  return <section className="panel monthly-report-page">
    <header className="list-toolbar monthly-report-toolbar">
      <div><span className="panel-kicker">{activeCard?.kicker}</span><h2 className="list-title">{activeCard?.title} · {formatMonthLabel(month)}</h2></div>
      <div className="toolbar-actions monthly-report-actions">
        <button className="button button-outline" type="button" onClick={closeReport}>Back to reports</button>
        <button className="button button-primary" type="button" disabled={!report || loading} onClick={() => window.print()}>Export PDF</button>
      </div>
    </header>
    <p className="monthly-report-caption">Use Export PDF, then choose “Save as PDF” in the print dialog.</p>
    <div className="monthly-report-filters">
      <label>Report month<input type="month" value={month} onChange={(event) => updateMonth(event.target.value)} /></label>
      {reportType !== "materials" && <label>Site / project<select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
        <option value="All">All sites</option>{projectOptions.map((project) => <option value={project} key={project}>{project}</option>)}
      </select></label>}
      {reportType === "expenses" && <label>Transaction type<select value={recordTypeFilter} onChange={(event) => setRecordTypeFilter(event.target.value)}>
        <option value="All">Cash in and out</option><option value="payment">Cash in · payments</option><option value="expense">Cash out · expenses</option>
      </select></label>}
      {reportType === "materials" && <>
        <label>Material<select value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)}>
          <option value="All">All materials</option>{materialOptions.map((material) => <option value={material} key={material}>{material}</option>)}
        </select></label>
        <label>Site / project<select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
          <option value="All">All sites</option>{projectOptions.map((project) => <option value={project} key={project}>{project}</option>)}
        </select></label>
      </>}
    </div>
    {loading && <div className="inline-empty" role="status">Loading report…</div>}
    {error && <div className="inline-empty" role="alert">{error} <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {report && !loading && <>
      <ReportSummary report={report} records={filteredRecords} materialFilter={materialFilter} />
      {report.type === "progress" && <div className="data-table-wrap"><table className="data-table monthly-report-table">
        <thead><tr><th>Project / site</th><th>Status</th><th>Current progress</th><th>Updates this month</th></tr></thead>
        <tbody>{filteredRecords.map((record) => <tr key={record.id ?? record.name}>
          <td><strong>{recordText(record.name)}</strong><small>{recordText(record.site)}</small></td>
          <td>{recordText(record.status) || "—"}</td><td>{recordNumber(record.progress)}%</td>
          <td>{(record.updates ?? []).map((update) => <div className="monthly-report-update" key={update.id}>
            <strong>{recordText(update.stage) || "Update"} · {update.createdAt ? new Date(update.createdAt).toLocaleDateString() : "Date not recorded"}</strong>
            <span>{recordText(update.description) || recordText(update.action)}</span>
          </div>)}
            {record.updates?.length ? null : "No updates"}
          </td>
        </tr>)}</tbody>
      </table></div>}
      {report.type === "expenses" && <div className="data-table-wrap"><table className="data-table monthly-report-table">
        <thead><tr><th>Date</th><th>Type</th><th>Site / project</th><th>Description / recorder</th><th>Method</th><th>Amount</th></tr></thead>
        <tbody>{filteredRecords.map((record) => <tr key={record.id}>
          <td>{recordText(record.date)}</td><td>{record.recordType === "payment" ? "Cash in" : "Cash out"}</td>
          <td>{recordText(record.project)}</td><td>{recordText(record.description) || recordText(record.note) || recordText(record.recordedBy) || recordText(record.submittedBy)}</td>
          <td>{recordText(record.method) || recordText(record.status) || "—"}</td><td>{formatCurrency(recordNumber(record.amount))}</td>
        </tr>)}</tbody>
      </table></div>}
      {report.type === "materials" && <div className="data-table-wrap"><table className="data-table monthly-report-table">
        <thead><tr><th>Type</th><th>Material</th><th>Site / project</th><th>Quantity / stock</th><th>Date</th><th>Engineer</th></tr></thead>
        <tbody>{filteredRecords.map((record) => <tr key={`${record.recordType}-${record.id}`}>
          <td>{record.recordType === "inventory" ? "Current stock" : record.recordType === "usage" ? "Used" : "Assigned"}</td>
          <td>{recordText(record.material)}</td><td>{recordText(record.project) || "Company inventory"}</td>
          <td>{record.recordType === "inventory" ? recordText(record.stock) : `${recordNumber(record.quantity)} ${recordText(record.unit)}`.trim()}</td>
          <td>{recordText(record.loggedAt) || recordText(record.assignedAt) || recordText(record.lastUpdated)}</td>
          <td>{recordText(record.engineer) || "—"}</td>
        </tr>)}</tbody>
      </table></div>}
      {filteredRecords.length === 0 && <div className="inline-empty">No records match the selected filters.</div>}
      <small className="monthly-report-generated">Generated {new Date(report.generatedAt).toLocaleString()}</small>
    </>}
  </section>;
}
