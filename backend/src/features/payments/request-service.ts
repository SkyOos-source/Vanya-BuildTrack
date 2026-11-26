import { nextId, paymentRequests, people, projects, readAmount, readText } from "../../data/store";
import { publishWorkspaceUpdate } from "../../realtime";
import { failure, result, today } from "../shared";

export const listPaymentRequests = () => paymentRequests;

export function createPaymentRequest(body: any) {
  const project = readText(body?.project);
  const amount = readAmount(body?.amount);
  const requestedBy = readText(body?.requestedBy);
  const requestedByEmail = readText(body?.requestedByEmail);
  const dueDate = readText(body?.dueDate);
  const note = readText(body?.note);

  if (!project || !projects.some((item) => item.name === project)) {
    return failure(400, "Select an existing project for this payment request.");
  }
  if (amount === null || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    return failure(400, "Enter a positive payment request amount with no more than two decimal places.");
  }
  if (!requestedBy || !requestedByEmail) {
    return failure(400, "The owner identity could not be verified.");
  }

  const projectRecord = projects.find((item) => item.name === project);
  const client = people.find((person) => person.role === "Client" &&
    (person.project === project || person.name === projectRecord?.client));
  const request = {
    id: nextId("payment-request"),
    project,
    amount,
    requestedBy,
    requestedByEmail: requestedByEmail.toLowerCase(),
    requestedAt: new Date().toISOString(),
    ...(dueDate ? { dueDate } : {}),
    ...(note ? { note: note.slice(0, 500) } : {}),
    status: "Pending" as const
  };
  paymentRequests.unshift(request);
  publishWorkspaceUpdate({
    resource: "paymentRequests",
    project,
    ...(client ? {
      push: {
        title: "Payment request received",
        body: `${requestedBy} requested ${amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })} for ${project}.`,
        targets: [{ role: "client" as const, userName: client.name, userEmail: client.email, url: "/client/payments" }]
      }
    } : {})
  });
  return result({ record: request }, 201);
}

export function cancelPaymentRequest(id: string) {
  const request = paymentRequests.find((item) => item.id === id);
  if (!request) return failure(404, "Payment request not found.");
  if (request.status !== "Pending") return failure(409, "This payment request is no longer pending.");
  request.status = "Cancelled";
  publishWorkspaceUpdate({ resource: "paymentRequests", project: request.project });
  return result({ record: request });
}
