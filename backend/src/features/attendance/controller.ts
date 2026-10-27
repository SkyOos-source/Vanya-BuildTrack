import { Body, Get, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { listAttendance, recordAttendance } from "./service";

@Route("api/attendance")
export class AttendanceController extends ApiController {
  @Get()
  public list() { return listAttendance(); }

  @Post()
  public record(@Body() body: any): any { return this.respond(recordAttendance(body)); }
}
