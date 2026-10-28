import { isDemoRole, people, readText, verifyClientCredential, verifyEmployeeCredential } from "../../data/store";
import { demoUsers } from "./data";
import { failure, result } from "../shared";

export function login(body: any) {
  const email = readText(body?.email)?.toLowerCase() ?? "";
  const password = readText(body?.password) ?? "";
  const role: unknown = body?.role;
  if (!isDemoRole(role)) return failure(400, "Choose a valid account role.");
  const user = demoUsers[role];
  const demoLogin = email === user.email && password === user.password;
  const invitedEmployeeLogin = role === "employee" && verifyEmployeeCredential(email, password);
  const invitedClientLogin = role === "client" && verifyClientCredential(email, password);
  if (!demoLogin && !invitedEmployeeLogin && !invitedClientLogin) {
    return failure(401, "Email or password is incorrect for this role.");
  }
  const invitedPerson = invitedEmployeeLogin || invitedClientLogin ? findPerson(email, role) : undefined;
  const account = invitedPerson ?? user;
  return result({ user: { name: account.name, email: account.email, role } });
}

export const logout = () => result({ status: "ok" });

function findPerson(email: string, role: "employee" | "client") {
  const personRole = role === "employee" ? "Site Engineer" : "Client";
  return people.find((person) => person.email.toLowerCase() === email && person.role === personRole);
}
