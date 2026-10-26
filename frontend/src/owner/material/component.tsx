import type { DashboardData } from "../../common/types";

type OwnerMaterialsProps = { data: DashboardData; onToast: (message: string) => void };

export function OwnerMaterialsComponent({ data, onToast }: OwnerMaterialsProps) {
  return <div className="feature-page"><section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">SITE INVENTORY</span><h2 className="list-title">Materials received & used</h2></div><button className="button button-primary" onClick={() => onToast("Material entry form is ready for API implementation.")}>＋ Log materials</button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Received</th><th>Used</th><th>In stock</th><th>Last updated</th></tr></thead><tbody>{data.materials.map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.project}</td><td>{item.received}</td><td>{item.used}</td><td>{item.stock}</td><td>{item.lastUpdated}</td></tr>)}</tbody></table></div></section></div>;
}
