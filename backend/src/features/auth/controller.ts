import { Body, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { login, logout } from "./service";

@Route("api/auth")
export class AuthController extends ApiController {
  @Post("login")
  public signIn(@Body() body: any): any {
    return this.respond(login(body));
  }

  @Post("logout")
  public signOut(): any {
    return this.respond(logout());
  }
}
