import { Body, Get, Post, Request, Route } from "tsoa";
import type { Request as ExpressRequest } from "express";
import { ApiController } from "../shared";
import { initialOwnerSetupStatus, login, logout, refresh, setupInitialOwners } from "./service";

@Route("api/auth")
export class AuthController extends ApiController {
  @Get("setup/status")
  public setupStatus(): any {
    this.setHeader("Cache-Control", "no-store");
    return initialOwnerSetupStatus();
  }

  @Post("setup")
  public setup(@Body() body: unknown): any {
    return setupInitialOwners(body).then((value) => this.respond(value));
  }

  @Post("login")
  public signIn(@Body() body: any): any {
    return login(body).then((value) => this.respond(value));
  }

  @Post("refresh")
  public renew(@Body() body: any): any {
    return refresh(body).then((value) => this.respond(value));
  }

  @Post("logout")
  public signOut(@Request() request: ExpressRequest, @Body() body: any): any {
    return logout(request.get("authorization"), body?.refreshToken).then((value) => this.respond(value));
  }
}
