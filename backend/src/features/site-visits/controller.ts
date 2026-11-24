import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createSiteVisit, listSiteVisits, updateSiteVisit } from "./service";

@Route("api/site-visits")
export class SiteVisitsController extends ApiController {
  @Get()
  public list() { return listSiteVisits(); }

  @Post()
  public async create(@Body() body: any): Promise<any> { return this.respond(await createSiteVisit(body)); }

  @Patch("{id}")
  public async update(@Path() id: string, @Body() body: any): Promise<any> { return this.respond(await updateSiteVisit(id, body)); }
}
