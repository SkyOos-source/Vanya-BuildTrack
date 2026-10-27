import { useState } from "react";
import { ProjectCards } from "../../common/components";
import type { DashboardData, Project, RecordModalType } from "../../common/types";
import { ProjectDetails } from "../../common/project-details";

type OwnerProjectsProps = {
  projects: Project[];
  data: DashboardData;
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  onCreate: (modal: RecordModalType | null) => void;
};

export function OwnerProjectsComponent({ projects, data, search, setSearch, filter, setFilter, onCreate }: OwnerProjectsProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = data.projects.find((project) => project.id === selectedProjectId);
  if (selectedProject) {
    return <div className="feature-page"><ProjectDetails project={selectedProject} data={data} onBack={() => setSelectedProjectId(null)} /></div>;
  }

  return <div className="feature-page"><section className="panel feature-panel"><div className="list-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search projects" placeholder="Search projects, sites, clients..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="toolbar-actions"><select className="select-button project-filter-select" aria-label="Filter projects" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>In progress</option><option>On track</option><option>At risk</option></select><button className="button button-primary" onClick={() => onCreate("project")}>＋ New project</button></div></div><ProjectCards projects={projects.filter((project) => filter === "All" || project.status === filter)} onOpen={(project) => setSelectedProjectId(project.id)} /></section></div>;
}
