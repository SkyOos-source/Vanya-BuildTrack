import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createSiteVisit, listSiteVisits, updateSiteVisit } from "./service";

@Route("api/site-visits")
export class SiteVisitsController extends ApiController {
  @Get()
  public list() { return listSiteVisits(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createSiteVisit(body)); }

  @Patch("{id}")
  public update(@Path() id: string, @Body() body: any): any { return this.respond(updateSiteVisit(id, body)); }
}
