import { isDemoRole, ownerAccount, people, readText, verifyClientCredential, verifyEmployeeCredential, verifyOwnerCredential } from "../../data/store";
import { failure, result } from "../shared";

export function login(body: any) {
  const email = readText(body?.email)?.toLowerCase() ?? "";
  const password = readText(body?.password) ?? "";
  const role: unknown = body?.role;
  if (!isDemoRole(role)) return failure(400, "Choose a valid account role.");
  const ownerLogin = role === "owner" && verifyOwnerCredential(email, password);
  const invitedEmployeeLogin = role === "employee" && verifyEmployeeCredential(email, password);
  const invitedClientLogin = role === "client" && verifyClientCredential(email, password);
  if (!ownerLogin && !invitedEmployeeLogin && !invitedClientLogin) {
    return failure(401, "Email or password is incorrect for this role.");
  }
  const invitedPerson = invitedEmployeeLogin || invitedClientLogin ? findPerson(email, role) : undefined;
  const account = invitedPerson ?? ownerAccount;
  return result({ user: { name: account.name, email: account.email, role } });
}

export const logout = () => result({ status: "ok" });

function findPerson(email: string, role: "employee" | "client") {
  const personRole = role === "employee" ? "Site Engineer" : "Client";
  return people.find((person) => person.email.toLowerCase() === email && person.role === personRole);
}
