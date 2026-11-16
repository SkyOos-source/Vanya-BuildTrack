import { nextId, people, projects, readAmount, readAttachment, readText, type ExpenseAllocation } from "../../data/store";
import { expenses, expenseAllocations } from "./data";
import { failure, result, today } from "../shared";

export const listExpenses = () => expenses;

function allocationTotals(allocation: ExpenseAllocation) {
  const spentAmount = expenses
    .filter((expense) => expense.allocationId === allocation.id &&
      (expense.entryType === "log" || (!expense.entryType && expense.status === "Logged")))
    .reduce((total, expense) => total + expense.amount, 0);
  return { ...allocation, spentAmount, remainingAmount: Math.max(0, allocation.amount - spentAmount) };
}

export const listExpenseAllocations = (engineer?: string) =>
  expenseAllocations.filter((allocation) => !engineer || allocation.engineer.toLowerCase() === engineer.toLowerCase())
    .map(allocationTotals);

export function createExpenseAllocation(body: any) {
  const engineer = readText(body?.engineer);
  const amount = readAmount(body?.amount);
  if (!engineer || amount === null || amount <= 0) {
    return failure(400, "A site engineer and a positive allocation amount are required.");
  }
  if (!people.some((person) => person.role === "Site Engineer" && person.name.toLowerCase() === engineer.toLowerCase())) {
    return failure(400, "Select an existing site engineer.");
  }
  const allocation = {
    id: nextId("expense-allocation"),
    engineer,
    amount,
    assignedAt: today(),
    assignedBy: readText(body?.assignedBy) ?? "Owner"
  };
  expenseAllocations.unshift(allocation);
  return result({ record: allocationTotals(allocation) }, 201);
}

export function createExpense(body: any) {
  const description = readText(body?.description);
  const project = readText(body?.project);
  const amount = readAmount(body?.amount);
  const attachment = readAttachment(body?.attachment);
  const isLog = body?.entryType === "log";
  if (!project || !projects.some((item) => item.name === project)) {
    return failure(400, "Select an existing project for this expense.");
  }
  if (!description || amount === null || amount <= 0 || (body?.attachment && !attachment)) {
    return failure(400, "Expense description, project, positive amount, and a supported attachment are required.");
  }
  let allocation: ExpenseAllocation | undefined;
  const allocationId = readText(body?.allocationId);
  if (body?.requireAllocation === true && !allocationId) {
    return failure(400, "Select an expense allocation before logging the expense.");
  }
  if (allocationId) {
    allocation = expenseAllocations.find((item) => item.id === allocationId);
    if (!allocation || allocation.engineer.toLowerCase() !== String(body?.submittedBy ?? "").toLowerCase()) {
      return failure(400, "Select one of your assigned expense allocations.");
    }
    if (!isLog) return failure(400, "Expense requests cannot be charged to an allocation.");
    if (amount > allocationTotals(allocation).remainingAmount) {
      return failure(400, "The expense amount exceeds the remaining allocated funds.");
    }
  }
  const expense = {
    id: nextId("expense"), project, category: "Other", description, amount, date: today(),
    submittedBy: readText(body?.submittedBy) ?? "Arjun Mehta", attachment: attachment ?? undefined,
    status: isLog ? "Logged" : "Pending review",
    entryType: isLog ? "log" as const : "request" as const,
    ...(allocation ? { allocationId: allocation.id } : {})
  };
  expenses.unshift(expense);
  return result({ record: expense }, 201);
}

export function updateExpense(id: string, body: any) {
  const status = body?.status;
  if (!["Approved", "Declined", "Paid"].includes(status)) return failure(400, "Expense status must be Approved, Declined, or Paid.");
  const expense = expenses.find((item) => item.id === id);
  if (!expense) return failure(404, "Expense not found.");
  expense.status = status;
  return result({ record: expense });
}
