import { Get, Path, Post, Request, Res, Route, TsoaResponse } from "tsoa";
import type { Request as ExpressRequest } from "express";
import { Readable } from "node:stream";
import { ApiController, failure } from "../shared";
import { authenticateBearerHeader } from "../auth/session";
import { createBackup, downloadBackup, listBackups } from "./service";

type OwnerAuthorization =
  | { session: NonNullable<ReturnType<typeof authenticateBearerHeader>> }
  | { error: string; status: 401 | 403 };

function authorizeOwner(request: ExpressRequest): OwnerAuthorization {
  const session = authenticateBearerHeader(request.get("authorization"));
  if (!session) return { status: 401, error: "Sign-in is required to access backups." };
  if (session.role !== "owner") return { status: 403, error: "Owner access is required to access backups." };
  return { session };
}

@Route("api/backups")
export class BackupsController extends ApiController {
  @Get()
  public list(@Request() request: ExpressRequest): any {
    const authorization = authorizeOwner(request);
    if ("error" in authorization) return this.respond(failure(authorization.status, authorization.error));
    return listBackups();
  }

  @Post()
  public create(@Request() request: ExpressRequest): any {
    const authorization = authorizeOwner(request);
    if ("error" in authorization) return this.respond(failure(authorization.status, authorization.error));
    return this.respond(createBackup(authorization.session.name));
  }

  @Get("{id}/download")
  public download(@Request() request: ExpressRequest, @Path() id: string, @Res() responder: TsoaResponse<200 | 401 | 403 | 404, any>): void {
    const authorization = authorizeOwner(request);
    if ("error" in authorization) {
      responder(authorization.status, { error: authorization.error });
      return;
    }
    const response = downloadBackup(id);
    const body = response.status === 200 ? Readable.from(response.body) : response.body;
    responder(response.status as 200 | 404, body, response.headers);
  }
}
