import { activities, attendance, backups, expenses, feedback, materials, people, projects, quotations, siteVisits } from "../../data/store";

export const dashboardData = () => ({
  projects,
  quotes: quotations,
  expenses,
  siteVisits,
  activities,
  materials,
  attendance,
  feedback,
  backups,
  people
});
