import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./landing/page";
import { SignInPage } from "./auth/page";
import { PortalRoute } from "./common/portal-app";
import { CookieConsent } from "./common/cookie-consent";
import { DataUsagePage, NotFoundPage, PrivacyPolicyPage } from "./common/legal-pages";
import { PublicProfilePage } from "./common/profile-page";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/data-usage" element={<DataUsagePage />} />
        <Route path="/profile/:id" element={<PublicProfilePage />} />
        <Route path="/admin/*" element={<PortalRoute role="owner" />} />
        <Route path="/employee/*" element={<PortalRoute role="employee" />} />
        <Route path="/client/*" element={<PortalRoute role="client" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <CookieConsent />
    </>
  );
}
