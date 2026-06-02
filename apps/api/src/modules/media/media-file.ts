import { BadRequestException } from "@nestjs/common";
import { MEDIA_ALLOWED_MIME_TYPES } from "@structo/contracts";

export interface UploadedMediaFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export function detectMediaMimeType(buffer: Buffer): string | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a") return "image/gif";
  if (buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

export function assertAllowedMediaFile(file: UploadedMediaFile): string {
  const detected = detectMediaMimeType(file.buffer);
  if (
    !detected ||
    !MEDIA_ALLOWED_MIME_TYPES.includes(
      detected as (typeof MEDIA_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    throw new BadRequestException("Unsupported media file type.");
  }
  if (file.mimetype !== detected) {
    throw new BadRequestException(
      "Uploaded file content does not match its declared MIME type.",
    );
  }
  return detected;
}

export function readImageDimensions(
  buffer: Buffer,
  mimeType: string,
): ImageDimensions | null {
  if (mimeType === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === "image/gif" && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (mimeType === "image/jpeg") return readJpegDimensions(buffer);
  return null;
}

export function extensionForMimeType(mimeType: string): string {
  return (
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "application/pdf": "pdf",
    }[mimeType] ?? "bin"
  );
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (
      marker !== undefined &&
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    if (segmentLength < 2) return null;
    offset += segmentLength + 2;
  }
  return null;
}

function startsWith(buffer: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte);
}
