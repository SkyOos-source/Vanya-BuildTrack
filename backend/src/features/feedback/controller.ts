import { Body, Get, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createFeedback, listFeedback } from "./service";

@Route("api/feedback")
export class FeedbackController extends ApiController {
  @Get()
  public list() { return listFeedback(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createFeedback(body)); }
}
