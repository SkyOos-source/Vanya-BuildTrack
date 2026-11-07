import { Body, Get, Patch, Query, Route } from "tsoa";
import { ApiController } from "../shared";
import { getWorkspacePalette, updateWorkspacePalette } from "./service";

@Route("api/settings/palette")
export class SettingsController extends ApiController {
  @Get()
  public getPalette(): any {
    return this.respond(getWorkspacePalette());
  }

  @Patch()
  public updatePalette(@Query() email: string, @Body() body: unknown): any {
    return this.respond(updateWorkspacePalette(email, body));
  }
}
