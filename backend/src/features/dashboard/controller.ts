import { Get, Route } from "tsoa";
import { getDashboard } from "./service";

@Route("api/dashboard")
export class DashboardController {
  @Get()
  public get() {
    return getDashboard();
  }
}
