import QRCode from "qrcode";
import { ownerAccount, ownerProfile, people, readText } from "../../data/store";
import { failure, result } from "../shared";

type PublicProfile = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Site Engineer" | "Client";
  phone: string;
  image: string | null;
};

function findProfile(role: string, email: string): PublicProfile | undefined {
  const normalizedEmail = email.trim().toLowerCase();
  if (role === "owner" && normalizedEmail === ownerAccount.email) {
    return {
      id: "owner",
      name: ownerAccount.name,
      email: ownerAccount.email,
      role: "Owner",
      phone: ownerProfile.phone,
      image: ownerProfile.image || null
    };
  }

  const personRole = role === "employee" ? "Site Engineer" : role === "client" ? "Client" : null;
  if (!personRole) return undefined;
  const person = people.find((item) => item.email.toLowerCase() === normalizedEmail && item.role === personRole);
  if (!person) return undefined;
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    role: person.role,
    phone: person.phone ?? "",
    image: person.image ?? null
  };
}

export function updateMyProfile(role: string, email: string, body: unknown) {
  const profile = findProfile(role, email);
  if (!profile) return failure(404, "Profile not found.");
  if (profile.role !== "Owner" && profile.role !== "Site Engineer") {
    return failure(403, "Only owner and site engineer profiles can be updated.");
  }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  let phone = profile.phone;
  if (Object.hasOwn(input, "phone")) {
    const inputPhone = input.phone === "" || input.phone === null ? "" : readText(input.phone);
    if (inputPhone === null) return failure(400, "Enter a valid phone number.");
    phone = inputPhone;
    const digits = phone.replace(/\D/g, "");
    if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || digits.length < 7 || digits.length > 15)) {
      return failure(400, "Enter a valid phone number with 7 to 15 digits.");
    }
  }
  let image: string | undefined;
  if (Object.hasOwn(input, "image")) {
    if (input.image === null || input.image === "") image = "";
    else if (typeof input.image === "string" &&
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(input.image) &&
      input.image.length <= 1_800_000) image = input.image;
    else return failure(400, "Choose a valid JPEG, PNG, or WebP profile photo smaller than 1.8 MB.");
  }
  if (role === "owner") {
    if (Object.hasOwn(input, "phone")) ownerProfile.phone = phone;
    if (image !== undefined) ownerProfile.image = image;
  }
  else {
    const person = people.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.role === "Site Engineer");
    if (!person) return failure(404, "Profile not found.");
    if (Object.hasOwn(input, "phone")) person.phone = phone;
    if (image !== undefined) person.image = image;
  }
  return result({ profile: { ...profile, phone, image: image === undefined ? profile.image : image || null } });
}

export async function getMyProfile(role: string, email: string, origin: string) {
  const profile = findProfile(role, email);
  if (!profile) return failure(404, "Profile not found.");

  let qrCode: string | null = null;
  if (profile.role === "Owner" || profile.role === "Site Engineer") {
    const baseUrl = new URL(origin);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      return failure(400, "A valid profile link address is required.");
    }
    const publicUrl = new URL(`/profile/${encodeURIComponent(profile.id)}`, baseUrl).toString();
    qrCode = await QRCode.toDataURL(publicUrl, { errorCorrectionLevel: "M", margin: 2, width: 256 });
  }

  return result({ profile, qrCode });
}

export function getPublicProfile(id: string) {
  if (id === "owner") {
    return result({
      profile: {
        id,
        name: ownerAccount.name,
        email: ownerAccount.email,
        role: "Owner",
        phone: ownerProfile.phone,
        image: ownerProfile.image || null
      },
      qrCode: null
    });
  }
  const person = people.find((item) => item.id === id && item.role === "Site Engineer");
  if (!person) return failure(404, "This public profile is not available.");
  return result({
    profile: {
      id: person.id,
      name: person.name,
      email: person.email,
      role: person.role,
      phone: person.phone ?? "",
      image: person.image ?? null
    },
    qrCode: null
  });
}
