import { activities, backups, expenses, feedback, materialRequests, materials, people, projects, quotations, siteVisits } from "../../data/store";
import { listAttendance } from "../attendance/service";

export const dashboardData = () => ({
  projects,
  quotes: quotations,
  expenses,
  siteVisits,
  activities,
  materials,
  materialRequests,
  attendance: listAttendance(),
  feedback,
  backups,
  people
});
