import { activities, backups, expenses, feedback, materialRequests, materials, people, projects, siteVisits } from "../../data/store";
import { listAttendance } from "../attendance/service";
import { listExpenseAllocations } from "../expenses/service";
import { listQuotationsWithClientEmails } from "../quotations/data";

export const dashboardData = () => ({
  projects,
  quotes: listQuotationsWithClientEmails(),
  expenses,
  expenseAllocations: listExpenseAllocations(),
  siteVisits,
  activities,
  materials,
  materialRequests,
  attendance: listAttendance(),
  feedback,
  backups,
  people
});
