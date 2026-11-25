import { Body, Get, Patch, Path, Post, Route } from "tsoa";
import { ApiController } from "../shared";
import { createMaterial, createMaterialAllocation, createMaterialCategory, createMaterialRequest, createMaterialUsage, listMaterialAllocations, listMaterialCategories, listMaterialRequests, listMaterialUsage, listMaterials, updateMaterialRequest } from "./service";

@Route("api/materials")
export class MaterialsController extends ApiController {
  @Get()
  public list() { return listMaterials(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createMaterial(body)); }
}

@Route("api/material-categories")
export class MaterialCategoriesController extends ApiController {
  @Get()
  public list() { return listMaterialCategories(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createMaterialCategory(body)); }
}

@Route("api/material-requests")
export class MaterialRequestsController extends ApiController {
  @Get()
  public list() { return listMaterialRequests(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createMaterialRequest(body)); }

  @Patch("{id}")
  public update(@Path() id: string, @Body() body: any): any { return this.respond(updateMaterialRequest(id, body)); }
}

@Route("api/material-allocations")
export class MaterialAllocationsController extends ApiController {
  @Get()
  public list() { return listMaterialAllocations(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createMaterialAllocation(body)); }
}

@Route("api/material-usage")
export class MaterialUsageController extends ApiController {
  @Get()
  public list() { return listMaterialUsage(); }

  @Post()
  public create(@Body() body: any): any { return this.respond(createMaterialUsage(body)); }
}
