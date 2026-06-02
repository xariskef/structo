import { BadRequestException } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type ResolveHost = (hostname: string) => Promise<string[]>;

async function resolveHost(hostname: string): Promise<string[]> {
  if (isIP(hostname)) return [hostname];

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.map(({ address }) => address);
  } catch {
    throw new BadRequestException(
      "publicBaseUrl hostname could not be resolved.",
    );
  }
}

export async function assertSafePublicBaseUrl(
  value: string,
  resolve: ResolveHost = resolveHost,
): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new BadRequestException("publicBaseUrl must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new BadRequestException(
      "publicBaseUrl must not include credentials.",
    );
  }
  if (url.port && url.port !== "443") {
    throw new BadRequestException(
      "publicBaseUrl must use the standard HTTPS port.",
    );
  }

  const addresses = await resolve(stripIpv6Brackets(url.hostname));
  if (addresses.length === 0) {
    throw new BadRequestException(
      "publicBaseUrl hostname could not be resolved.",
    );
  }
  if (addresses.some(isRestrictedAddress)) {
    throw new BadRequestException(
      "publicBaseUrl must not resolve to a private or local network address.",
    );
  }
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function isRestrictedAddress(address: string): boolean {
  if (address.includes(":")) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) {
      return isRestrictedAddress(normalized.slice("::ffff:".length));
    }
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }

  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return true;
  const [first, second] = octets as [number, number, number, number];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}
