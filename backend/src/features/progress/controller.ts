import { Body, Get, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createProgress, listProgress } from "./service";

@Route("api/progress")
export class ProgressController extends ApiController {
  @Get()
  public list() { return listProgress(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createProgress(body)); }
}
