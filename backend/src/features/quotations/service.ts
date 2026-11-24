import { nextId, people, projects, readAmount, readPdfAttachment, readText } from "../../data/store";
import { publishWorkspaceUpdate } from "../../realtime";
import { listQuotationsWithClientEmails, quotations } from "./data";
import { failure, result, today } from "../shared";
import { R2StorageError, uploadBase64Pdf } from "../../object-storage/r2";

export const listQuotations = () => listQuotationsWithClientEmails();

export async function createQuotation(body: any) {
  const title = readText(body?.title);
  const project = readText(body?.project);
  const amount = readAmount(body?.amount);
  const attachment = readPdfAttachment(body?.quotationAttachment);
  if (!title || !project || amount === null) return failure(400, "Quotation title, project, and non-negative amount are required.");
  if (body?.quotationAttachment && !attachment) return failure(400, "Quotation attachment must be a valid PDF file.");
  let uploadedAttachment: string | undefined;
  if (attachment) {
    try {
      uploadedAttachment = await uploadBase64Pdf(attachment, "quotations");
    } catch (error) {
      return failure(error instanceof R2StorageError ? 503 : 500, error instanceof R2StorageError ? error.message : "Quotation PDF could not be uploaded.");
    }
  }
  const client = people.find((person) => person.role === "Client" && person.project === project);
  const quote = {
    id: nextId("quotation"),
    project,
    title,
    client: projects.find((item) => item.name === project)?.client ?? "Unassigned",
    ...(client ? { clientEmail: client.email.toLowerCase() } : {}),
    amount,
    date: today(),
    status: "Awaiting review",
    ...(uploadedAttachment ? { attachment: uploadedAttachment } : {})
  };
  quotations.unshift(quote);
  const projectRecord = projects.find((item) => item.name === project);
  if (projectRecord) {
    projectRecord.quotationAmount = quotations
      .filter((item) => item.project === project)
      .reduce((total, item) => total + item.amount, 0);
  }
  publishWorkspaceUpdate({
    resource: "quotations",
    project: quote.project,
    ...(quote.client !== "Unassigned" ? {
      push: {
        title: "New quotation from Vanya BuildTrack",
        body: `A quotation for ${quote.project} is ready for your review.`,
        targets: [{ role: "client" as const, userName: quote.client, url: "/client/my-projects" }]
      }
    } : {})
  });
  return result({ record: quote }, 201);
}

export function updateQuotation(id: string, body: any) {
  const status = body?.status;
  if (status !== "Approved" && status !== "Declined") return failure(400, "Quotation status must be Approved or Declined.");
  const quote = quotations.find((item) => item.id === id);
  if (!quote) return failure(404, "Quotation not found.");
  const newlyApproved = status === "Approved" && quote.status !== "Approved";
  quote.status = status;
  publishWorkspaceUpdate({
    resource: "quotations",
    project: quote.project,
    ...(newlyApproved ? {
      push: {
        title: "Quotation approved",
        body: `The quotation for ${quote.project} was approved by the client.`,
        targets: [{ role: "owner" as const, url: "/admin/quotations" }]
      }
    } : {})
  });
  return result({ record: quote });
}
