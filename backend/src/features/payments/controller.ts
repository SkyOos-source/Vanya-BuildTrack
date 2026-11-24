import { Body, Get, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createPayment, listPayments } from "./service";

@Route("api/payments")
export class PaymentsController extends ApiController {
  @Get()
  public list() { return listPayments(); }

  @Post()
  public async create(@Body() body: any): Promise<any> { return this.respond(await createPayment(body)); }
}
