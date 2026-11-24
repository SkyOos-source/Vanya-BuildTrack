import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createWorkRequest, listWorkRequests, reviewWorkRequest } from "./service";

@Route("api/work-requests")
export class WorkRequestsController extends ApiController {
  @Get()
  public list() { return listWorkRequests(); }

  @Post()
  public async create(@Body() body: any): Promise<any> { return this.respond(await createWorkRequest(body)); }

  @Patch("{id}")
  public review(@Path() id: string, @Body() body: any): any { return this.respond(reviewWorkRequest(id, body)); }
}
