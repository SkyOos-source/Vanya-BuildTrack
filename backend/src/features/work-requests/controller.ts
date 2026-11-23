import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createWorkRequest, listWorkRequests, reviewWorkRequest } from "./service";

@Route("api/work-requests")
export class WorkRequestsController extends ApiController {
  @Get()
  public list() { return listWorkRequests(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createWorkRequest(body)); }

  @Patch("{id}")
  public review(@Path() id: string, @Body() body: any): any { return this.respond(reviewWorkRequest(id, body)); }
}
