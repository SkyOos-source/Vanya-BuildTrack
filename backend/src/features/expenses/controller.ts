import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createExpense, createExpenseAllocation, listExpenseAllocations, listExpenses, updateExpense } from "./service";

@Route("api/expenses")
export class ExpensesController extends ApiController {
  @Get()
  public list() { return listExpenses(); }

  @Get("allocations")
  public listAllocations() { return listExpenseAllocations(); }

  @Post("allocations")
  public createAllocation(@Body() body: any): any { return this.respond(createExpenseAllocation(body)); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createExpense(body)); }

  @Patch("{id}")
  public update(@Path() id: string, @Body() body: any): any { return this.respond(updateExpense(id, body)); }
}
