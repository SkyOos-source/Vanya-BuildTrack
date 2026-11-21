import { activities, backups, expenses, feedback, materialRequests, materialUsageLogs, materials, payments, people, projects, siteVisits } from "../../data/store";
import { listAttendance } from "../attendance/service";
import { listExpenseAllocations } from "../expenses/service";
import { listMaterialAllocations } from "../materials/service";
import { listQuotationsWithClientEmails } from "../quotations/data";

export const dashboardData = () => ({
  projects,
  quotes: listQuotationsWithClientEmails(),
  expenses,
  payments,
  expenseAllocations: listExpenseAllocations(),
  siteVisits,
  activities,
  materials,
  materialAllocations: listMaterialAllocations(),
  materialUsageLogs,
  materialRequests,
  attendance: listAttendance(),
  feedback,
  backups,
  people
});
