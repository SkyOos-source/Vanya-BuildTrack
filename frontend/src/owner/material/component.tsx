import { useState } from "react";
import type { DashboardData, MaterialRequest, RecordModalType } from "../../common/types";

type OwnerMaterialsProps = {
  data: DashboardData;
  onCreate: (modal: RecordModalType | null) => void;
  onMaterialRequestStatus: (request: MaterialRequest, status: "Approved" | "Declined", stockAction?: boolean | "record") => void;
};

export function OwnerMaterialsComponent({ data, onCreate, onMaterialRequestStatus }: OwnerMaterialsProps) {
  const [projectFilter, setProjectFilter] = useState("All");
  const [requestStatusFilter, setRequestStatusFilter] = useState("All");
  const projects = data.projects.map((project) => project.name);
  const allocations = data.materialAllocations.filter((item) => projectFilter === "All" || item.project === projectFilter);
  const usageLogs = data.materialUsageLogs.filter((item) => projectFilter === "All" || item.project === projectFilter);
  const materialRequests = data.materialRequests.filter((request) =>
    (requestStatusFilter === "All" || request.status === requestStatusFilter) &&
    (projectFilter === "All" || request.project === projectFilter)
  );
  const inventory = data.materials;
  const hasAvailableMaterials = data.materialAllocations.some((item) => item.remainingQuantity > 0);

  return <div className="feature-page owner-materials-page">
    <section className="panel feature-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">MATERIAL CATEGORIES</span><h2 className="list-title">Company material categories</h2></div><div className="toolbar-actions">
        <button className="button button-outline" onClick={() => onCreate("material-category")}>＋ Add category</button>
      </div></div>
      {data.materialCategories.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Created by</th><th>Created</th></tr></thead><tbody>
        {data.materialCategories.map((category) => <tr key={category.id}><td>{category.name}</td><td>{category.createdBy || "—"}</td><td>{category.createdAt}</td></tr>)}
      </tbody></table></div> : <p className="people-empty">No material categories yet. Add a category before recording stock.</p>}
    </section>
    <section className="panel feature-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">COMPANY MATERIALS</span><h2 className="list-title">Materials available to the company</h2></div><div className="toolbar-actions">
        <button className="button button-outline" onClick={() => onCreate("material")}>＋ Record materials</button>
      </div></div>
      {inventory.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Category</th><th>Received</th><th>Used</th><th>In stock</th><th>Last updated</th></tr></thead><tbody>
        {inventory.map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.category || "—"}</td><td>{item.received}</td><td>{item.used}</td><td>{item.stock}</td><td>{item.lastUpdated}</td></tr>)}
      </tbody></table></div> : <p className="people-empty">No company material records yet.</p>}
    </section>

    <section className="panel feature-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">SITE ASSIGNMENTS & REQUESTS</span><h2 className="list-title">Assigned materials</h2></div><div className="toolbar-actions">
        <select className="select-button" aria-label="Filter assignments and requests by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="All">All projects</option>{projects.map((project) => <option key={project} value={project}>{project}</option>)}</select>
        <select className="select-button" aria-label="Filter assignments and requests by status" value={requestStatusFilter} onChange={(event) => setRequestStatusFilter(event.target.value)}><option value="All">All request statuses</option><option>Pending review</option><option>Approved</option><option>Declined</option></select>
        <button className="button button-primary" onClick={() => onCreate("material-allocation")}>＋ Assign materials</button>
      </div></div>
      {allocations.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Engineer</th><th>Assigned</th><th>Used</th><th>Remaining</th><th>Assigned by</th></tr></thead><tbody>
        {allocations.map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.project}</td><td>{item.engineer}</td><td>{item.quantity} {item.unit}</td><td>{item.usedQuantity} {item.unit}</td><td>{item.remainingQuantity} {item.unit}</td><td>{item.assignedBy}<small className="table-subtext">{item.assignedAt}</small></td></tr>)}
      </tbody></table></div> : <p className="people-empty">No materials have been assigned to sites yet.</p>}
      <div className="material-request-history"><div className="list-toolbar"><div><span className="panel-kicker">ENGINEER REQUESTS</span><h3 className="list-title">Requests for additional materials</h3></div></div>
        {materialRequests.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Quantity</th><th>Requested by</th><th>Requested</th><th>Status</th><th>Review</th></tr></thead><tbody>
          {materialRequests.map((request) => {
            const inventoryRecordExists = inventory.some((item) =>
              (item.category ?? item.material).toLowerCase() === request.material.toLowerCase()
            );
            return <tr key={request.id}><td>{request.material}{request.note && <small className="table-subtext">{request.note}</small>}</td><td>{request.project}</td><td>{request.quantity}</td><td>{request.requestedBy}</td><td>{request.requestedAt}</td><td><span className={`status-badge status-${request.status.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{request.status}</span></td><td>{request.status === "Pending review" ? <div className="table-actions"><button className="button button-outline" onClick={() => onMaterialRequestStatus(request, "Approved")}>Approve & assign</button><button className="button button-outline" onClick={() => onMaterialRequestStatus(request, "Declined")}>Decline</button></div> : request.status === "Approved" && !inventoryRecordExists ? <button className="button button-outline" onClick={() => onMaterialRequestStatus(request, "Approved", "record")}>Record in inventory</button> : request.reviewedBy ? `Reviewed by ${request.reviewedBy}` : "—"}</td></tr>;
          })}
        </tbody></table></div> : <p className="people-empty">No material requests match this filter.</p>}
      </div>
    </section>

    <section className="panel feature-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">MATERIAL LOGS</span><h2 className="list-title">Engineer and owner material logs</h2></div><div className="toolbar-actions">
        <button className="button button-primary" disabled={!hasAvailableMaterials} onClick={() => onCreate("material-log")}>＋ Log material</button>
      </div></div>
      {!hasAvailableMaterials && <p className="feature-subtitle">Assign available company materials to a project before logging material use.</p>}
      {usageLogs.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Used</th><th>Assigned engineer</th><th>Logged by</th><th>Logged</th><th>Note</th></tr></thead><tbody>
        {usageLogs.map((log) => <tr key={log.id}><td>{log.material}</td><td>{log.project}</td><td>{log.quantity} {log.unit}</td><td>{log.engineer}</td><td>{log.loggedBy || log.engineer}</td><td>{log.loggedAt}</td><td>{log.note || "—"}</td></tr>)}
      </tbody></table></div> : <p className="people-empty">No material usage logs have been submitted yet.</p>}
    </section>
  </div>;
}
