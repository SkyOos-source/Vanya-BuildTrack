import { ProjectCards } from "../../common/components";
import type { Project } from "../../common/types";
import { formatCurrency } from "../../common/utils";

type OwnerProjectsProps = {
  projects: Project[];
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  onCreate: (modal: "project" | "quote" | "progress" | "expense" | "visit" | null) => void;
  onToast: (message: string) => void;
};

export function OwnerProjectsComponent({ projects, search, setSearch, filter, setFilter, onCreate, onToast }: OwnerProjectsProps) {
  return <div className="feature-page"><section className="panel feature-panel"><div className="list-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search projects" placeholder="Search projects, sites, clients..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter projects" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>In progress</option><option>On track</option><option>At risk</option></select><button className="button button-primary" onClick={() => onCreate("project")}>＋ New project</button></div></div><ProjectCards projects={projects.filter((project) => filter === "All" || project.status === filter)} onOpen={(project) => onToast(`${project.name} · ${project.progress}% complete · ${formatCurrency(project.spent)} spent.`)} /></section></div>;
}
