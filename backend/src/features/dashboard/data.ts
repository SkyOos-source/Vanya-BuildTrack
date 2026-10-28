import { activities, attendance, backups, expenses, feedback, materialRequests, materials, people, projects, quotations, siteVisits } from "../../data/store";

export const dashboardData = () => ({
  projects,
  quotes: quotations,
  expenses,
  siteVisits,
  activities,
  materials,
  materialRequests,
  attendance,
  feedback,
  backups,
  people
});
