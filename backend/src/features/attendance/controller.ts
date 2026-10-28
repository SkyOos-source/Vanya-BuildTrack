import { Body, Delete, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createAttendanceLeave, deleteAttendanceLeave, listAttendance, listAttendanceLeaves, recordAttendance, regularizeAttendance } from "./service";

@Route("api/attendance")
export class AttendanceController extends ApiController {
  @Get()
  public list() { return listAttendance(); }

  @Get("leaves")
  public listLeaves() { return listAttendanceLeaves(); }

  @Post("leaves")
  public createLeave(@Body() body: any): any { return this.respond(createAttendanceLeave(body)); }

  @Delete("leaves/{id}")
  public deleteLeave(@Path() id: string): any { return this.respond(deleteAttendanceLeave(id)); }

  @Patch("{id}/regularize")
  public regularize(@Path() id: string, @Body() body: any): any { return this.respond(regularizeAttendance(id, body)); }

  @Post()
  public record(@Body() body: any): any { return this.respond(recordAttendance(body)); }
}
