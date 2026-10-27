import { Controller, Get, Route } from "tsoa";
import { getHealth } from "./service";

@Route("api/health")
export class HealthController extends Controller {
  @Get()
  public get() {
    return getHealth();
  }
}
