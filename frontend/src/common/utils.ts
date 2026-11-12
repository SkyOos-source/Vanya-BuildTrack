export const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
export const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

const MAX_COMPRESSED_IMAGE_BYTES = 500 * 1024;

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
