import { Body, Delete, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createPerson, deletePerson, listPeople, updatePerson } from "./service";

@Route("api/people")
export class PeopleController extends ApiController {
  @Get()
  public list() { return listPeople(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createPerson(body)); }

  @Patch("{id}")
  public update(@Path() id: string, @Body() body: any): any { return this.respond(updatePerson(id, body)); }

  @Delete("{id}")
  public delete(@Path() id: string): any { return this.respond(deletePerson(id)); }
}
