import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  MEDIA_MAX_UPLOAD_BYTES,
  updateMediaAssetSchema,
} from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { UploadedMediaFile } from "./media-file.js";
import { MediaService } from "./media.service.js";

@Controller("manage")
export class MediaController {
  constructor(
    @Inject(MediaService)
    private readonly mediaService: MediaService,
  ) {}

  @Get("sites/:siteId/media")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.mediaService.list(user.id, siteId);
  }

  @Post("sites/:siteId/media")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MEDIA_MAX_UPLOAD_BYTES } }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @UploadedFile() file?: UploadedMediaFile,
  ) {
    return this.mediaService.upload(user.id, siteId, file);
  }

  @Patch("sites/:siteId/media/:assetId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("assetId") assetId: string,
    @Body() body: unknown,
  ) {
    return this.mediaService.update(
      user.id,
      siteId,
      assetId,
      parseInput(updateMediaAssetSchema, body),
    );
  }

  @Delete("sites/:siteId/media/:assetId")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("assetId") assetId: string,
  ) {
    return this.mediaService.remove(user.id, siteId, assetId);
  }
}
