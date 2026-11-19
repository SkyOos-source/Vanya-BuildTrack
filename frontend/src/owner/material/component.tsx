import { useState } from "react";
import type { DashboardData, MaterialRequest, RecordModalType } from "../../common/types";

type OwnerMaterialsProps = {
  data: DashboardData;
  onCreate: (modal: RecordModalType | null) => void;
  onMaterialRequestStatus: (request: MaterialRequest, status: "Approved" | "Declined") => void;
};

export function OwnerMaterialsComponent({ data, onCreate, onMaterialRequestStatus }: OwnerMaterialsProps) {
  const [projectFilter, setProjectFilter] = useState("All");
  const [requestStatusFilter, setRequestStatusFilter] = useState("All");
  const projects = data.projects.map((project) => project.name);
  const materialRequests = data.materialRequests.filter((request) =>
    (requestStatusFilter === "All" || request.status === requestStatusFilter) &&
    (projectFilter === "All" || request.project === projectFilter)
  );
  const allocations = data.materialAllocations.filter((item) => projectFilter === "All" || item.project === projectFilter);
  const inventory = data.materials.filter((item) => projectFilter === "All" || item.project === projectFilter);

  return <div className="feature-page">
    <section className="panel feature-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">SITE INVENTORY</span><h2 className="list-title">Materials received & used</h2></div><div className="toolbar-actions">
        <select className="select-button" aria-label="Filter materials by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="All">All projects</option>{projects.map((project) => <option key={project} value={project}>{project}</option>)}</select>
        <button className="button button-outline" onClick={() => onCreate("material")}>＋ Record stock</button>
        <button className="button button-primary" onClick={() => onCreate("material-allocation")}>＋ Assign materials</button>
      </div></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Received</th><th>Used</th><th>In stock</th><th>Last updated</th></tr></thead><tbody>
        {inventory.map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.project}</td><td>{item.received}</td><td>{item.used}</td><td>{item.stock}</td><td>{item.lastUpdated}</td></tr>)}
      </tbody></table></div>
      {!inventory.length && <p className="people-empty">No stock records for this project yet.</p>}
    </section>

    <section className="panel feature-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">ASSIGNED TO SITES</span><h2 className="list-title">Engineer material balances</h2></div></div>
      {allocations.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Engineer</th><th>Assigned</th><th>Used</th><th>Remaining</th><th>Assigned by</th></tr></thead><tbody>
        {allocations.map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.project}</td><td>{item.engineer}</td><td>{item.quantity} {item.unit}</td><td>{item.usedQuantity} {item.unit}</td><td>{item.remainingQuantity} {item.unit}</td><td>{item.assignedBy}<small className="table-subtext">{item.assignedAt}</small></td></tr>)}
      </tbody></table></div> : <p className="people-empty">No materials have been assigned to sites yet.</p>}
    </section>

    <section className="panel feature-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">ENGINEER REQUESTS</span><h2 className="list-title">Material requests</h2></div><select className="select-button" aria-label="Filter material requests by status" value={requestStatusFilter} onChange={(event) => setRequestStatusFilter(event.target.value)}><option value="All">All statuses</option><option>Pending review</option><option>Approved</option><option>Declined</option></select></div>
      {materialRequests.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Quantity</th><th>Requested by</th><th>Requested</th><th>Status</th><th>Review</th></tr></thead><tbody>
        {materialRequests.map((request) => <tr key={request.id}><td>{request.material}{request.note && <small className="table-subtext">{request.note}</small>}</td><td>{request.project}</td><td>{request.quantity}</td><td>{request.requestedBy}</td><td>{request.requestedAt}</td><td><span className={`status-badge status-${request.status.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{request.status}</span></td><td>{request.status === "Pending review" ? <div className="table-actions"><button className="button button-outline" onClick={() => onMaterialRequestStatus(request, "Approved")}>Approve & assign</button><button className="button button-outline" onClick={() => onMaterialRequestStatus(request, "Declined")}>Decline</button></div> : request.reviewedBy ? `Reviewed by ${request.reviewedBy}` : "—"}</td></tr>)}
      </tbody></table></div> : <p className="people-empty">No material requests match this filter.</p>}
    </section>
  </div>;
}
