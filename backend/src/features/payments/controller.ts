import { Body, Get, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createPayment, listPayments } from "./service";

@Route("api/payments")
export class PaymentsController extends ApiController {
  @Get()
  public list() { return listPayments(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createPayment(body)); }
}
