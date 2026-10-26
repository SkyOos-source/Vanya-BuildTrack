import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "./landing/page";
import { SignInPage } from "./auth/page";
import { PortalRoute } from "./common/portal-app";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/admin/*" element={<PortalRoute role="owner" />} />
      <Route path="/employee/*" element={<PortalRoute role="employee" />} />
      <Route path="/client/*" element={<PortalRoute role="client" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
