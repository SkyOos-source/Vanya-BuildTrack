import { Body, Get, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createMaterial, createMaterialRequest, listMaterialRequests, listMaterials } from "./service";

@Route("api/materials")
export class MaterialsController extends ApiController {
  @Get()
  public list() { return listMaterials(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createMaterial(body)); }
}

@Route("api/material-requests")
export class MaterialRequestsController extends ApiController {
  @Get()
  public list() { return listMaterialRequests(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createMaterialRequest(body)); }
}
