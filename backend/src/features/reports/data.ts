import { activities, expenses, materialUsageLogs, materials, payments, projects } from "../../data/store";
import { listAttendance } from "../attendance/service";
import { listMaterialAllocations } from "../materials/service";

function monthForDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const isoDate = /^(\d{4})-(\d{2})-\d{2}(?:$|T)/.exec(value);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isInMonth(value: unknown, month: string) {
  return monthForDate(value) === month;
}

function quantityParts(value: string) {
  const match = /^(\d+(?:\.\d+)?)\s*(.*?)$/.exec(value.trim());
  if (!match) return null;
  const quantity = Number(match[1]);
  return Number.isFinite(quantity) ? { quantity, unit: match[2].trim() } : null;
}

function groupQuantities(records: Array<{ material: string; quantity: number; unit: string }>) {
  const totals = new Map<string, { material: string; quantity: number; unit: string }>();
  for (const record of records) {
    const key = `${record.material.toLocaleLowerCase()}|${record.unit.toLocaleLowerCase()}`;
    const total = totals.get(key);
    if (total) total.quantity += record.quantity;
    else totals.set(key, { ...record });
  }
  return Array.from(totals.values()).map((record) => ({
    ...record,
    quantity: Math.round(record.quantity * 1000) / 1000
  }));
}

export function reportForMonth(type: string, month: string) {
  if (type === "projects") {
    return { records: projects, summary: { siteCount: projects.length } };
  }

  if (type === "attendance") {
    const records = listAttendance().filter((record) => isInMonth(record.date, month));
    return { records, summary: { attendanceCount: records.length } };
  }

  if (type === "progress") {
    const updates = activities.filter((activity) => activity.kind === "progress" && isInMonth(activity.createdAt, month));
    const records = projects.map((project) => ({
      ...project,
      updates: updates.filter((activity) => activity.project === project.name)
    }));
    return {
      records,
      summary: {
        siteCount: records.length,
        averageProgress: records.length
          ? Math.round(records.reduce((total, project) => total + project.progress, 0) / records.length)
          : 0,
        updatesCount: updates.length
      }
    };
  }

  if (type === "expenses") {
    const monthlyExpenses = expenses.filter((expense) =>
      isInMonth(expense.date, month) &&
      (expense.entryType === "log" || (!expense.entryType && expense.status === "Logged") || expense.status === "Paid")
    );
    const monthlyPayments = payments.filter((payment) => isInMonth(payment.date, month));
    const cashOut = Math.round(monthlyExpenses.reduce((total, expense) => total + expense.amount, 0) * 100) / 100;
    const cashIn = Math.round(monthlyPayments.reduce((total, payment) => total + payment.amount, 0) * 100) / 100;
    return {
      records: [
        ...monthlyExpenses.map((expense) => ({ recordType: "expense", ...expense })),
        ...monthlyPayments.map((payment) => ({ recordType: "payment", ...payment }))
      ],
      summary: {
        totalExpenses: cashOut,
        cashOut,
        cashIn,
        cashPayments: Math.round(monthlyPayments.filter((payment) => payment.method === "Cash")
          .reduce((total, payment) => total + payment.amount, 0) * 100) / 100,
        onlinePayments: Math.round(monthlyPayments.filter((payment) => payment.method === "Online")
          .reduce((total, payment) => total + payment.amount, 0) * 100) / 100
      }
    };
  }

  if (type === "materials") {
    const monthlyUsage = materialUsageLogs.filter((log) => isInMonth(log.loggedAt, month));
    const stock = materials.flatMap((material) => {
      const quantity = quantityParts(material.stock);
      return quantity ? [{ material: material.material, ...quantity }] : [];
    });
    const used = monthlyUsage.map((log) => ({ material: log.material, quantity: log.quantity, unit: log.unit }));
    const monthlyAllocations = listMaterialAllocations().filter((allocation) => isInMonth(allocation.assignedAt, month));
    return {
      records: [
        ...materials.map((material) => ({ recordType: "inventory", ...material })),
        ...monthlyAllocations.map((allocation) => ({ recordType: "allocation", ...allocation })),
        ...monthlyUsage.map((log) => ({ recordType: "usage", ...log }))
      ],
      summary: {
        currentStock: groupQuantities(stock),
        used: groupQuantities(used)
      }
    };
  }

  return null;
}
