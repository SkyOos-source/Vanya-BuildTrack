import { nextId, people, projects, readAmount, readCompressedImage, readText, type ExpenseAllocation } from "../../data/store";
import { expenses, expenseAllocations } from "./data";
import { failure, result, today } from "../shared";
import { R2StorageError, uploadBase64Image } from "../../object-storage/r2";

export const listExpenses = () => expenses;

function readPositiveCurrencyAmount(value: unknown) {
  const amount = readAmount(value);
  if (amount === null || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 1e-7) return null;
  return cents / 100;
}

function amountInCents(amount: number) {
  return Math.round(amount * 100);
}

function allocationTotals(allocation: ExpenseAllocation) {
  const spentCents = expenses
    .filter((expense) => expense.allocationId === allocation.id &&
      (expense.entryType === "log" || (!expense.entryType && expense.status === "Logged")))
    .reduce((total, expense) => total + amountInCents(expense.amount), 0);
  const allocationCents = amountInCents(allocation.amount);
  return {
    ...allocation,
    spentAmount: spentCents / 100,
    remainingAmount: (allocationCents - spentCents) / 100
  };
}

export const listExpenseAllocations = (engineer?: string) =>
  expenseAllocations.filter((allocation) => !engineer || allocation.engineer.toLowerCase() === engineer.toLowerCase())
    .map(allocationTotals);

export function createExpenseAllocation(body: any) {
  const engineer = readText(body?.engineer);
  const amount = readPositiveCurrencyAmount(body?.amount);
  if (!engineer || amount === null) {
    return failure(400, "A site engineer and a positive allocation amount with no more than two decimal places are required.");
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

export async function createExpense(body: any) {
  const description = readText(body?.description);
  const project = readText(body?.project);
  const amount = readPositiveCurrencyAmount(body?.amount);
  const attachment = readCompressedImage(body?.attachment);
  const isLog = body?.entryType === "log";
  if (!project || !projects.some((item) => item.name === project)) {
    return failure(400, "Select an existing project for this expense.");
  }
  if (!description || amount === null || (body?.attachment && !attachment)) {
    return failure(400, "Expense description, project, positive amount with no more than two decimal places, and a valid image attachment are required.");
  }
  let uploadedAttachment = attachment ?? undefined;
  if (attachment) {
    try {
      uploadedAttachment = await uploadBase64Image(attachment, "expenses");
    } catch (error) {
      return failure(error instanceof R2StorageError ? 503 : 500, error instanceof R2StorageError ? error.message : "Expense attachment could not be uploaded.");
    }
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
  }
  const expense = {
    id: nextId("expense"), project, category: "Other", description, amount, date: today(),
    submittedBy: readText(body?.submittedBy) ?? "Arjun Mehta", attachment: uploadedAttachment,
    status: isLog ? "Logged" : "Pending review",
    entryType: isLog ? "log" as const : "request" as const,
    ...(allocation ? { allocationId: allocation.id } : {})
  };
  expenses.unshift(expense);
  return result({ record: expense }, 201);
}

export function updateExpense(id: string, body: any) {
  const expense = expenses.find((item) => item.id === id);
  if (!expense) return failure(404, "Expense not found.");
  if (expense.entryType === "log" || expense.status === "Logged") {
    return failure(400, "Logged expenses are recorded immediately and do not require approval.");
  }
  const status = body?.status;
  if (!["Approved", "Declined", "Paid"].includes(status)) return failure(400, "Expense status must be Approved, Declined, or Paid.");
  expense.status = status;
  return result({ record: expense });
}
