import { nextId, payments, projects, readAmount, readCompressedImage, readText } from "../../data/store";
import { failure, result, today } from "../shared";
import { R2StorageError, uploadBase64Image } from "../../object-storage/r2";

export const listPayments = () => payments;

export async function createPayment(body: any) {
  const project = readText(body?.project);
  const amount = readAmount(body?.amount);
  const method = body?.method;
  const proofImage = readCompressedImage(body?.proofImage);
  const recordedBy = readText(body?.recordedBy);
  const recordedByRole = body?.recordedByRole;
  const note = readText(body?.note);
  if (!project || !projects.some((item) => item.name === project)) {
    return failure(400, "Select an existing project for this payment.");
  }
  if (amount === null || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    return failure(400, "Enter a positive payment amount with no more than two decimal places.");
  }
  if (method !== "Cash" && method !== "Online") {
    return failure(400, "Choose Cash or Online as the payment method.");
  }
  if (method === "Online" && !proofImage) {
    return failure(400, "Upload a valid payment proof image for online payments.");
  }
  if (method === "Cash" && body?.proofImage) {
    return failure(400, "Payment proof images are only accepted for online payments.");
  }
  if (!recordedBy || (recordedByRole !== "Owner" && recordedByRole !== "Client")) {
    return failure(400, "The payment recorder could not be verified.");
  }
  let uploadedProof: string | undefined;
  if (proofImage) {
    try {
      uploadedProof = await uploadBase64Image(proofImage, "payments");
    } catch (error) {
      return failure(error instanceof R2StorageError ? 503 : 500, error instanceof R2StorageError ? error.message : "Payment proof could not be uploaded.");
    }
  }
  const payment = {
    id: nextId("payment"),
    project,
    amount,
    method,
    recordedBy,
    recordedByRole,
    date: today(),
    ...(note ? { note: note.slice(0, 500) } : {}),
    ...(proofImage ? { proofImage: uploadedProof } : {})
  };
  payments.unshift(payment);
  return result({ record: payment }, 201);
}
