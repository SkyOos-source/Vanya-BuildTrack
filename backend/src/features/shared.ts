import { Controller } from "tsoa";

export type ApiResult = {
  status?: number;
  body: any;
  headers?: Record<string, string>;
};

export const result = (body: any, status = 200, headers?: Record<string, string>): ApiResult => ({ body, status, headers });
export const failure = (status: number, error: string): ApiResult => result({ error }, status);

export abstract class ApiController extends Controller {
  protected respond(value: ApiResult): any {
    if (value.status !== undefined) this.setStatus(value.status);
    for (const [name, header] of Object.entries(value.headers ?? {})) this.setHeader(name, header);
    return value.body;
  }
}

export const today = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
