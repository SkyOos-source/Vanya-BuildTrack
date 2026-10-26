import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createQuotation, listQuotations, updateQuotation } from "./service";

@Route("api/quotations")
export class QuotationsController extends ApiController {
  @Get()
  public list() { return listQuotations(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createQuotation(body)); }

  @Patch("{id}")
  public update(@Path() id: string, @Body() body: any): any { return this.respond(updateQuotation(id, body)); }
}
