import { Body, Post, Request, Route } from "tsoa";
import type { Request as ExpressRequest } from "express";
import { ApiController } from "../shared";
import { login, logout, refresh } from "./service";

@Route("api/auth")
export class AuthController extends ApiController {
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
