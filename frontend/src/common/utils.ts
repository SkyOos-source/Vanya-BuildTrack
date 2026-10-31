export const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
export const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
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
