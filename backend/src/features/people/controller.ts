import { Body, Delete, Get, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createPerson, deletePerson, listPeople } from "./service";

@Route("api/people")
export class PeopleController extends ApiController {
  @Get()
  public list() { return listPeople(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createPerson(body)); }

  @Delete("{id}")
  public delete(@Path() id: string): any { return this.respond(deletePerson(id)); }
}
