import { Get, Path, Query, Route } from "tsoa";
import { ApiController } from "../shared";
import { getReport } from "./service";

@Route("api/reports")
export class ReportsController extends ApiController {
  @Get("{type}")
  public get(@Path() type: string, @Query() month?: string): any { return this.respond(getReport(type, month)); }
}
