import { Body, Get, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createProgress, listProgress } from "./service";

@Route("api/progress")
export class ProgressController extends ApiController {
  @Get()
  public list() { return listProgress(); }

  @Post()
  public async create(@Body() body: any): Promise<any> { return this.respond(await createProgress(body)); }
}
