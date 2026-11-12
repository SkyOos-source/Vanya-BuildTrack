import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { Role } from "./types";
import { roleId } from "./data";
import { compressImageFile, initials } from "./utils";
import { apiFetch } from "./api";

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  image: string | null;
};

type ProfileResponse = { profile: UserProfile; qrCode: string | null };
type LoadState = { profile: UserProfile; qrCode: string | null } | { error: string } | null;

function escapeVCard(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function saveContact(profile: UserProfile) {
  const formattedName = escapeVCard(profile.name);
  const contact = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${formattedName}`,
    `N:;${formattedName};;;`,
    `EMAIL;TYPE=INTERNET:${escapeVCard(profile.email)}`,
    ...(profile.phone ? [`TEL;TYPE=CELL:${escapeVCard(profile.phone)}`] : []),
    `TITLE:${escapeVCard(profile.role)}`,
    "END:VCARD",
    ""
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([contact], { type: "text/vcard;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${profile.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")}.vcf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function prepareProfilePhoto(file: File): Promise<string> {
  return compressImageFile(file, 512);
}

function ProfileDetails({ profile, qrCode, editable, onProfileImageChange }: ProfileResponse & {
  editable?: { role: Role; email: string };
  onProfileImageChange?: (image: string | null) => void;
}) {
  const [phone, setPhone] = useState(profile.phone);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [savedImage, setSavedImage] = useState(profile.image);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhone(profile.phone);
    setSavedImage(profile.image);
  }, [profile.id, profile.phone, profile.image]);

  const updatePhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await apiFetch(`/api/profiles/me?role=${encodeURIComponent(roleId(editable.role))}&email=${encodeURIComponent(editable.email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const result = await response.json() as { profile?: UserProfile; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error || `Phone number update failed (${response.status})`);
      setPhone(result.profile.phone);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to update the phone number.");
    } finally {
      setSaving(false);
    }
  };

  const selectPhoto = async (file: File | undefined) => {
    if (!file || !editable) return;
    setPhotoError("");
    setSavingPhoto(true);
    try {
      const image = await prepareProfilePhoto(file);
      const response = await apiFetch(`/api/profiles/me?role=${encodeURIComponent(roleId(editable.role))}&email=${encodeURIComponent(editable.email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image })
      });
      const result = await response.json() as { profile?: UserProfile; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error || `Profile photo update failed (${response.status})`);
      setSavedImage(result.profile.image);
      onProfileImageChange?.(result.profile.image);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Unable to prepare the selected photo.");
    } finally {
      setSavingPhoto(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  };

  const displayedImage = savedImage;
  return <section className="panel account-profile-card">
    <div className="account-profile-identity">
      {editable ? <button className="account-profile-avatar-button" type="button" aria-label="Change profile photo" title="Change profile photo" disabled={savingPhoto} onClick={() => photoInput.current?.click()}>
        <span className="account-profile-avatar">{displayedImage ? <img src={displayedImage} alt="" /> : initials(profile.name)}</span>
        <span className="account-profile-avatar-camera" aria-hidden="true">{savingPhoto ? "…" : "📷"}</span>
      </button> : <span className="account-profile-avatar">{displayedImage ? <img src={displayedImage} alt={`${profile.name} profile`} /> : initials(profile.name)}</span>}
      {editable && <input ref={photoInput} className="account-profile-photo-input" type="file" accept="image/*" aria-label="Choose profile photo" onChange={(event) => void selectPhoto(event.currentTarget.files?.[0])} />}
      <div><span className="panel-kicker">BUILDTRACK PROFILE</span><h2>{profile.name}</h2><span className="account-profile-role">{profile.role}</span></div>
    </div>
    {photoError && <p className="profile-load-error account-profile-photo-error" role="alert">{photoError}</p>}
    <dl className="account-profile-details">
      <div><dt>Email</dt><dd><a href={`mailto:${profile.email}`}>{profile.email}</a></dd></div>
      <div><dt>Phone</dt><dd>{phone ? <a href={`tel:${phone}`}>{phone}</a> : <span className="account-profile-missing">Not added</span>}</dd></div>
    </dl>
    {editable && <form className="account-profile-phone-form" onSubmit={(event) => void updatePhone(event)}>
      <label htmlFor="profile-phone">Phone number</label>
      <div><input id="profile-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 123 4567" pattern="\+?[\d\s().-]{7,20}" title="Enter a phone number with 7 to 15 digits." /><button className="button button-outline" type="submit" disabled={saving}>{saving ? "Saving…" : "Save number"}</button></div>
      {saveError && <p className="profile-load-error" role="alert">{saveError}</p>}
    </form>}
    {qrCode && <aside className="account-profile-qr">
      <div><span className="panel-kicker">SHARE YOUR PROFILE</span><h3>Scan to view your details</h3><p>This QR code opens your public BuildTrack profile.</p></div>
      <img src={qrCode} alt={`QR code linking to ${profile.name}'s public profile`} />
    </aside>}
  </section>;
}

function useProfile(url: string): LoadState {
  const [state, setState] = useState<LoadState>(null);

  useEffect(() => {
    let active = true;
    setState(null);
    const loadProfile = async () => {
      try {
        const response = await apiFetch(url);
        const result = await response.json() as ProfileResponse & { error?: string };
        if (!response.ok || !result.profile) throw new Error(result.error || `Profile request failed (${response.status})`);
        if (active) setState({ profile: result.profile, qrCode: result.qrCode });
      } catch (error) {
        if (active) setState({ error: error instanceof Error ? error.message : "Unable to load this profile." });
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [url]);

  return state;
}

function ProfileLoadResult({ state, editable, onProfileImageChange }: {
  state: LoadState;
  editable?: { role: Role; email: string };
  onProfileImageChange?: (image: string | null) => void;
}) {
  if (!state) return <p className="profile-load-message" role="status">Loading profile…</p>;
  if ("error" in state) return <p className="profile-load-error" role="alert">{state.error}</p>;
  return <ProfileDetails profile={state.profile} qrCode={state.qrCode} editable={editable} onProfileImageChange={onProfileImageChange} />;
}

function PublicProfileLoadResult({ state }: { state: LoadState }) {
  if (!state) return <p className="profile-load-message" role="status">Loading profile…</p>;
  if ("error" in state) return <p className="profile-load-error" role="alert">{state.error}</p>;
  const { profile } = state;
  return <section className="public-contact-card">
    <div className="public-contact-identity">
      <span className="public-contact-avatar">{profile.image ? <img src={profile.image} alt={`${profile.name} profile`} /> : initials(profile.name)}</span>
      <div><span className="panel-kicker">VANYA BUILDTRACK</span><h2>{profile.name}</h2><span>{profile.role}</span></div>
    </div>
    <div className="public-contact-details">
      <a href={`mailto:${profile.email}`}><span>Email</span><strong>{profile.email}</strong></a>
      {profile.phone && <a href={`tel:${profile.phone}`}><span>Phone</span><strong>{profile.phone}</strong></a>}
    </div>
    <button className="button button-primary public-contact-save" type="button" onClick={() => saveContact(profile)}>Save to contacts</button>
  </section>;
}

export function AccountProfilePage({ role, email, onProfileImageChange }: {
  role: Role;
  email: string;
  onProfileImageChange?: (image: string | null) => void;
}) {
  const state = useProfile(`/api/profiles/me?role=${encodeURIComponent(roleId(role))}&email=${encodeURIComponent(email)}`);
  return <div className="profile-page-content"><ProfileLoadResult state={state} editable={{ role, email }} onProfileImageChange={onProfileImageChange} /></div>;
}

export function PublicProfilePage() {
  const { id = "" } = useParams();
  const state = useProfile(`/api/profiles/${encodeURIComponent(id)}`);
  const publicState = state && "error" in state ? state : state ? { ...state, qrCode: null } : null;

  return <main className="public-profile-page">
    <header className="public-profile-header">
      <Link to="/" className="public-profile-brand">Vanya <span>BuildTrack</span></Link>
      <span>PUBLIC PROFILE</span>
    </header>
    <div className="public-profile-content">
      <span className="eyebrow"><span className="eyebrow-dot" /> BUILDTRACK / VERIFIED PROFILE</span>
      <h1>BuildTrack profile</h1>
      <p className="public-profile-description">Contact details shared by this BuildTrack account.</p>
      <PublicProfileLoadResult state={publicState} />
      <Link className="public-profile-home" to="/">Vanya BuildTrack</Link>
    </div>
  </main>;
}
