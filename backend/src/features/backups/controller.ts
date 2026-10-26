import { Get, Path, Post, Res, Route, TsoaResponse } from "tsoa";
import { Readable } from "node:stream";
import { ApiController } from "../shared";
import { createBackup, downloadBackup, listBackups } from "./service";

@Route("api/backups")
export class BackupsController extends ApiController {
  @Get()
  public list() { return listBackups(); }

  @Post()
  public create(): any { return this.respond(createBackup()); }

  @Get("{id}/download")
  public download(@Path() id: string, @Res() responder: TsoaResponse<200 | 404, any>): void {
    const response = downloadBackup(id);
    const body = response.status === 200 ? Readable.from(response.body) : response.body;
    responder(response.status as 200 | 404, body, response.headers);
  }
}
