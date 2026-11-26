import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createPayment, listPayments } from "./service";
import { cancelPaymentRequest, createPaymentRequest, listPaymentRequests } from "./request-service";

@Route("api/payments")
export class PaymentsController extends ApiController {
  @Get()
  public list() { return listPayments(); }

  @Post()
  public async create(@Body() body: any): Promise<any> { return this.respond(await createPayment(body)); }
}

@Route("api/payment-requests")
export class PaymentRequestsController extends ApiController {
  @Get()
  public list() { return listPaymentRequests(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createPaymentRequest(body)); }

  @Patch("{id}/cancel")
  public cancel(@Path() id: string): any { return this.respond(cancelPaymentRequest(id)); }
}
