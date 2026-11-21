import { useState } from "react";
import { ProjectCards } from "../../common/components";
import type { DashboardData, Project, RecordModalType } from "../../common/types";
import { ProjectDetails } from "../../common/project-details";

type OwnerProjectsProps = {
  projects: Project[];
  data: DashboardData;
  currentUser: string;
  search: string;
  setSearch: (value: string) => void;
  onCreate: (modal: RecordModalType | null, project?: Project) => void;
  onEditProject: (project: Project) => void;
};

export function OwnerProjectsComponent({ projects, data, currentUser, search, setSearch, onCreate, onEditProject }: OwnerProjectsProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = data.projects.find((project) => project.id === selectedProjectId);
  if (selectedProject) {
    return <div className="feature-page owner-projects-page"><ProjectDetails project={selectedProject} data={data} role="Owner" currentUser={currentUser} onBack={() => setSelectedProjectId(null)} onEdit={onEditProject} onCreate={onCreate} /></div>;
  }

  return <div className="feature-page owner-projects-page"><section className="panel feature-panel"><div className="list-toolbar owner-projects-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search projects" placeholder="Search projects, sites, clients..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="toolbar-actions"><button className="button button-primary" onClick={() => onCreate("project")}>＋ New project</button></div></div><ProjectCards projects={projects} onOpen={(project) => setSelectedProjectId(project.id)} /></section></div>;
}
