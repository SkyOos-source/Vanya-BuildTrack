import type { Expense } from "./types";

export const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
export const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
export const isLoggedExpense = (expense: Expense) => expense.entryType === "log" || (!expense.entryType && expense.status === "Logged");
export function withRetryGuidance(message: string): string {
  const detail = message.trim();
  if (!detail) return "The request failed. Please try again; if the problem persists, try again in a few minutes.";
  if (/try again|retry/i.test(detail)) return detail;
  return `${detail} Please try again; if the problem persists, try again in a few minutes.`;
}
export const monthKeyForDate = (value: string) => {
  const dateOnly = /^(\d{4})-(\d{2})-\d{2}/.exec(value);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
export const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
export const formatMonthLabel = (month: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | undefined> {
  const endpoint = import.meta.env.VITE_REVERSE_GEOCODER_URL?.trim();
  if (!endpoint) return undefined;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("The self-hosted reverse geocoder URL is invalid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The self-hosted reverse geocoder URL must use HTTP or HTTPS.");
  }
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Location name lookup failed (${response.status}).`);
    let result: { display_name?: unknown; address?: Record<string, unknown> };
    try {
      result = await response.json() as { display_name?: unknown; address?: Record<string, unknown> };
    } catch {
      throw new Error("Location name lookup returned an invalid response.");
    }
    const displayName = typeof result.display_name === "string" ? result.display_name.trim() : "";
    if (displayName) return displayName.slice(0, 300);
    const address = result.address;
    if (address) {
      const parts = [address.road, address.neighbourhood, address.suburb, address.city, address.town, address.village, address.state, address.country]
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => value.trim());
      const uniqueParts = parts.filter((value, index) => parts.findIndex((part) => part.toLowerCase() === value.toLowerCase()) === index);
      if (uniqueParts.length) return uniqueParts.join(", ").slice(0, 300);
    }
    return undefined;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Location name lookup timed out. Try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const MAX_COMPRESSED_IMAGE_BYTES = 500 * 1024;

export async function captureCameraPhoto(video: HTMLVideoElement, prefix: string): Promise<{ file: File; capturedAt: string }> {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    throw new Error("Camera is not ready yet. Please wait a moment and try again.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not capture the camera image. Please try again.");
  const capturedAt = new Date().toISOString();
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not capture the camera image. Please try again.")), "image/jpeg", 0.9);
  });
  return { file: new File([blob], `${prefix}-${Date.now()}.jpg`, { type: "image/jpeg" }), capturedAt };
}

export async function compressImageFile(file: File, maxDimension = 1280): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 20_000_000) throw new Error("Choose an image smaller than 20 MB.");
  const image = await createImageBitmap(file);
  try {
    let scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const qualities = [0.82, 0.72, 0.62, 0.52, 0.42];
    while (true) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the selected photo.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of qualities) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not compress the selected photo.")), "image/jpeg", quality);
        });
        if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Could not read the compressed photo."));
            reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the compressed photo."));
            reader.readAsDataURL(blob);
          });
        }
      }
      if (Math.max(canvas.width, canvas.height) <= 128) {
        throw new Error("The selected photo could not be compressed enough. Choose a smaller image.");
      }
      scale *= 0.8;
    }
  } finally {
    image.close();
  }
}

export function siteVisitDateParts(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return { month: "", day: value, label: value };
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: "numeric" }),
    label: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  };
}
export const googleReviewUrl = import.meta.env.VITE_GOOGLE_REVIEW_URL?.trim() || "https://www.google.com/maps/place/Vanya+Concrete+Technologies/@17.3783391,78.4328398,17z/data=!3m1!4b1!4m6!3m5!1s0x3bcb99884556ab37:0x9dae524963b85d5c!8m2!3d17.3783391!4d78.4328398!16s%2Fg%2F11jgb_phf_";
