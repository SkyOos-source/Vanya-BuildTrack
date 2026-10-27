import { Body, Delete, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createProject, deleteProject, listProjects, updateProject } from "./service";

@Route("api/projects")
export class ProjectsController extends ApiController {
  @Get()
  public list() { return listProjects(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createProject(body)); }

  @Patch("{id}")
  public update(@Path() id: string, @Body() body: any): any { return this.respond(updateProject(id, body)); }

  @Delete("{id}")
  public delete(@Path() id: string): any { return this.respond(deleteProject(id)); }
}
