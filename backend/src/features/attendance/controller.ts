import { Body, Delete, Get, Patch, Path, Post, Query, Route } from "tsoa";
import { ApiController } from "../shared";
import { createAttendanceLeave, createAttendanceRegularizationRequest, deleteAttendanceLeave, listAttendance, listAttendanceLeaves, listAttendanceRegularizationRequests, recordAttendance, regularizeAttendance, reviewAttendanceRegularizationRequest } from "./service";

@Route("api/attendance")
export class AttendanceController extends ApiController {
  @Get()
  public list() { return listAttendance(); }

  @Get("leaves")
  public listLeaves() { return listAttendanceLeaves(); }

  @Get("regularization-requests")
  public listRegularizationRequests(@Query() engineer?: string) { return listAttendanceRegularizationRequests(engineer); }

  @Post("regularization-requests")
  public requestRegularization(@Body() body: any): any { return this.respond(createAttendanceRegularizationRequest(body)); }

  @Patch("regularization-requests/{id}")
  public reviewRegularizationRequest(@Path() id: string, @Body() body: any): any { return this.respond(reviewAttendanceRegularizationRequest(id, body)); }

  @Post("leaves")
  public createLeave(@Body() body: any): any { return this.respond(createAttendanceLeave(body)); }

  @Delete("leaves/{id}")
  public deleteLeave(@Path() id: string): any { return this.respond(deleteAttendanceLeave(id)); }

  @Patch("{id}/regularize")
  public regularize(@Path() id: string, @Body() body: any): any { return this.respond(regularizeAttendance(id, body)); }

  @Post()
  public record(@Body() body: any): any { return this.respond(recordAttendance(body)); }
}
