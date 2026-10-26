import { nextId, readAmount, readAttachment, readText } from "../../data/store";
import { expenses } from "./data";
import { failure, result, today } from "../shared";

export const listExpenses = () => expenses;

export function createExpense(body: any) {
  const description = readText(body?.description);
  const project = readText(body?.project);
  const amount = readAmount(body?.amount);
  const attachment = readAttachment(body?.attachment);
  if (!description || !project || amount === null || (body?.attachment && !attachment)) {
    return failure(400, "Expense description, project, non-negative amount, and a supported attachment are required.");
  }
  const expense = {
    id: nextId("expense"), project, category: "Other", description, amount, date: today(),
    submittedBy: readText(body?.submittedBy) ?? "Arjun Mehta", attachment: attachment ?? undefined,
    status: "Pending review"
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
