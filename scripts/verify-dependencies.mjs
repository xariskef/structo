const DEFAULT_PACKAGES = [
  "pnpm",
  "turbo",
  "typescript",
  "prettier",
  "eslint",
  "@eslint/js",
  "typescript-eslint",
  "tsx",
  "@types/node",
  "next",
  "react",
  "react-dom",
  "@types/react",
  "@types/react-dom",
  "eslint-config-next",
  "@nestjs/core",
  "@nestjs/common",
  "@nestjs/platform-express",
  "@nestjs/swagger",
  "class-validator",
  "class-transformer",
  "reflect-metadata",
  "rxjs",
  "prisma",
  "@prisma/client",
  "@prisma/adapter-neon",
  "dotenv",
  "zod",
  "ajv",
  "argon2",
  "@nestjs/throttler",
  "@types/express",
];

const packages = process.argv.slice(2);
const requestedPackages = packages.length > 0 ? packages : DEFAULT_PACKAGES;

function isPrerelease(version) {
  return version.includes("-");
}

async function readRegistryPackage(packageName) {
  const encodedName = encodeURIComponent(packageName);
  const response = await fetch(`https://registry.npmjs.org/${encodedName}`);

  if (!response.ok) {
    throw new Error(`${packageName}: registry returned ${response.status}.`);
  }

  const registryPackage = await response.json();
  const latest = registryPackage["dist-tags"]?.latest;

  if (!latest) {
    throw new Error(`${packageName}: registry has no latest tag.`);
  }

  if (isPrerelease(latest)) {
    throw new Error(
      `${packageName}: latest tag points to prerelease ${latest}.`,
    );
  }

  return {
    name: packageName,
    latest,
    distTags: registryPackage["dist-tags"],
    engines: registryPackage.versions?.[latest]?.engines,
    peerDependencies: registryPackage.versions?.[latest]?.peerDependencies,
  };
}

const results = [];

for (const packageName of requestedPackages) {
  results.push(await readRegistryPackage(packageName));
}

console.log(
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      registry: "https://registry.npmjs.org",
      packages: results,
    },
    null,
    2,
  ),
);
