import { Body, Delete, Get, Patch, Path, Post, Query, Request, Route } from "tsoa";
import type { Request as ExpressRequest } from "express";
import { ApiController, failure } from "../shared";
import { authenticateBearerHeader } from "../auth/session";
import { createAttendanceLeave, createAttendanceLeaveRequest, createAttendanceRegularizationRequest, deleteAttendanceLeave, listAttendance, listAttendanceLeaves, listAttendanceLeaveRequests, listAttendanceRegularizationRequests, recordAttendance, regularizeAttendance, reviewAttendanceLeaveRequest, reviewAttendanceRegularizationRequest } from "./service";

@Route("api/attendance")
export class AttendanceController extends ApiController {
  @Get()
  public list() { return listAttendance(); }

  @Get("leaves")
  public listLeaves() { return listAttendanceLeaves(); }

  @Get("leave-requests")
  public listLeaveRequests(@Query() engineer?: string) { return listAttendanceLeaveRequests(engineer); }

  @Post("leave-requests")
  public requestLeave(@Body() body: any): any { return this.respond(createAttendanceLeaveRequest(body)); }

  @Patch("leave-requests/{id}")
  public reviewLeaveRequest(@Request() request: ExpressRequest, @Path() id: string, @Body() body: any): any {
    const session = authenticateBearerHeader(request.get("authorization"));
    if (!session) return this.respond(failure(401, "Sign-in is required to review leave requests."));
    if (session.role !== "owner") return this.respond(failure(403, "Owner access is required to review leave requests."));
    return this.respond(reviewAttendanceLeaveRequest(id, body, session.name));
  }

  @Get("regularization-requests")
  public listRegularizationRequests(@Query() engineer?: string) { return listAttendanceRegularizationRequests(engineer); }

  @Post("regularization-requests")
  public requestRegularization(@Body() body: any): any { return this.respond(createAttendanceRegularizationRequest(body)); }

  @Patch("regularization-requests/{id}")
  public reviewRegularizationRequest(@Request() request: ExpressRequest, @Path() id: string, @Body() body: any): any {
    const session = authenticateBearerHeader(request.get("authorization"));
    if (!session) return this.respond(failure(401, "Sign-in is required to review attendance requests."));
    if (session.role !== "owner") return this.respond(failure(403, "Owner access is required to review attendance requests."));
    return this.respond(reviewAttendanceRegularizationRequest(id, body, session.name));
  }

  @Post("leaves")
  public createLeave(@Body() body: any): any { return this.respond(createAttendanceLeave(body)); }

  @Delete("leaves/{id}")
  public deleteLeave(@Path() id: string): any { return this.respond(deleteAttendanceLeave(id)); }

  @Patch("{id}/regularize")
  public regularize(@Path() id: string, @Body() body: any): any { return this.respond(regularizeAttendance(id, body)); }

  @Post()
  public record(@Body() body: any): any { return this.respond(recordAttendance(body)); }
}
