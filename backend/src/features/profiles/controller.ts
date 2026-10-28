import { Body, Get, Patch, Path, Query, Request, Route } from "tsoa";
import type { Request as ExpressRequest } from "express";
import { ApiController, failure } from "../shared";
import { getMyProfile, getPublicProfile, updateMyProfile } from "./service";

@Route("api/profiles")
export class ProfilesController extends ApiController {
  @Get("me")
  public async me(@Query() role: string, @Query() email: string, @Request() request: ExpressRequest): Promise<any> {
    const host = request.get("host");
    if (!host) return this.respond(failure(400, "Could not determine the profile link address."));
    let origin = `${request.protocol}://${host}`;
    if (process.env.FRONTEND_URL) {
      try {
        const frontendUrl = new URL(process.env.FRONTEND_URL);
        if (frontendUrl.protocol !== "http:" && frontendUrl.protocol !== "https:") {
          return this.respond(failure(500, "FRONTEND_URL must use HTTP or HTTPS."));
        }
        origin = frontendUrl.origin;
      } catch {
        return this.respond(failure(500, "FRONTEND_URL must be a valid absolute URL."));
      }
    } else if (process.env.NODE_ENV !== "production") {
      const localUrl = new URL(origin);
      if (localUrl.port === "3001") localUrl.port = "5173";
      origin = localUrl.origin;
    }
    return this.respond(await getMyProfile(role, email, origin));
  }

  @Patch("me")
  public updateMe(@Query() role: string, @Query() email: string, @Body() body: unknown): any {
    return this.respond(updateMyProfile(role, email, body));
  }

  @Get("{id}")
  public profile(@Path() id: string): any {
    return this.respond(getPublicProfile(id));
  }
}
