import { nextId, projects, readCompressedImage, readText, workRequests } from "../../data/store";
import { failure, result } from "../shared";
import { R2StorageError, uploadBase64Image } from "../../object-storage/r2";

export const listWorkRequests = () => workRequests;

export async function createWorkRequest(body: any) {
  const project = readText(body?.project);
  const description = readText(body?.description);
  const requestedBy = readText(body?.requestedBy);
  const requesterEmail = readText(body?.requesterEmail);
  const photos = body?.photos === undefined ? [] : body.photos;
  if (!project || !projects.some((item) => item.name === project) ||
    !description || description.length > 2000 || !requestedBy ||
    !requesterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
    return failure(400, "Choose a project and provide a work description of up to 2,000 characters.");
  }
  if (!Array.isArray(photos) || photos.length > 5 || photos.some((photo) => !readCompressedImage(photo))) {
    return failure(400, "Attach up to five valid compressed photos.");
  }
  let uploadedPhotos: string[] = [];
  try {
    uploadedPhotos = await Promise.all(photos.map((photo: string) => uploadBase64Image(photo, `work-requests/${project}`)));
  } catch (error) {
    return failure(error instanceof R2StorageError ? 503 : 500, error instanceof R2StorageError ? error.message : "Work request photos could not be uploaded.");
  }
  const request = {
    id: nextId("work-request"),
    project,
    requestedBy,
    requesterEmail: requesterEmail.toLowerCase(),
    description,
    photos: uploadedPhotos,
    requestedAt: new Date().toISOString(),
    status: "Pending review" as const
  };
  workRequests.unshift(request);
  return result({ record: request }, 201);
}

export function reviewWorkRequest(id: string, body: any) {
  const request = workRequests.find((item) => item.id === id);
  if (!request) return failure(404, "Work request not found.");
  if (request.status !== "Pending review") return failure(409, "This work request has already been reviewed.");
  if (body?.status !== "Approved" && body?.status !== "Declined") {
    return failure(400, "Work request status must be Approved or Declined.");
  }
  const reviewedBy = readText(body?.reviewedBy);
  const reviewedByRole = body?.reviewedByRole;
  if (!reviewedBy || !["Owner", "Project Manager", "Site Engineer"].includes(reviewedByRole)) {
    return failure(400, "Reviewer identity is required.");
  }
  request.status = body.status;
  request.reviewedBy = reviewedBy;
  request.reviewedByRole = reviewedByRole;
  request.reviewedAt = new Date().toISOString();
  return result({ record: request });
}
