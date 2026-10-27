import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createExpense, listExpenses, updateExpense } from "./service";

@Route("api/expenses")
export class ExpensesController extends ApiController {
  @Get()
  public list() { return listExpenses(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createExpense(body)); }

  @Patch("{id}")
  public update(@Path() id: string, @Body() body: any): any { return this.respond(updateExpense(id, body)); }
}
