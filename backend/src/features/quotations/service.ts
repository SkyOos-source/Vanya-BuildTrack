import { nextId, projects, readAmount, readPdfAttachment, readText } from "../../data/store";
import { quotations } from "./data";
import { failure, result, today } from "../shared";

export const listQuotations = () => quotations;

export function createQuotation(body: any) {
  const title = readText(body?.title);
  const project = readText(body?.project);
  const amount = readAmount(body?.amount);
  const attachment = readPdfAttachment(body?.quotationAttachment);
  if (!title || !project || amount === null) return failure(400, "Quotation title, project, and non-negative amount are required.");
  if (body?.quotationAttachment && !attachment) return failure(400, "Quotation attachment must be a valid PDF file.");
  const quote = {
    id: nextId("quotation"),
    project,
    title,
    client: projects.find((item) => item.name === project)?.client ?? "Unassigned",
    amount,
    date: today(),
    status: "Awaiting review",
    ...(attachment ? { attachment } : {})
  };
  quotations.unshift(quote);
  return result({ record: quote }, 201);
}

export function updateQuotation(id: string, body: any) {
  const status = body?.status;
  if (status !== "Approved" && status !== "Declined") return failure(400, "Quotation status must be Approved or Declined.");
  const quote = quotations.find((item) => item.id === id);
  if (!quote) return failure(404, "Quotation not found.");
  quote.status = status;
  return result({ record: quote });
}
