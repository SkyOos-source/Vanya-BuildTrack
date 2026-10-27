import { isDemoRole, readText } from "../../data/store";
import { demoUsers } from "./data";
import { failure, result } from "../shared";

export function login(body: any) {
  const email = readText(body?.email)?.toLowerCase();
  const password = readText(body?.password);
  const role: unknown = body?.role;
  if (!isDemoRole(role)) return failure(400, "Choose a valid account role.");
  const user = demoUsers[role];
  if (email !== user.email || password !== user.password) {
    return failure(401, "Email or password is incorrect for this role.");
  }
  return result({ user: { name: user.name, email: user.email, role } });
}

export const logout = () => result({ status: "ok" });
