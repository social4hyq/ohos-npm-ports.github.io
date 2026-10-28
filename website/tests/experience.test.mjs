import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  installGuide,
  enrichPackage,
  searchPackages,
  readRoute,
  routeUrl,
  evidenceFor,
} from "../src/catalog.mjs";
const pkg = {
  name: "@ohos-npm-ports/sqlite3",
  shortName: "sqlite3",
  upstream: "sqlite3",
  version: "5.1.7-7",
  status: "active",
  versions: [{ version: "5.1.7-7" }],
};
test("package managers receive pinned, correctly located direct and indirect instructions", () => {
  for (const manager of ["npm", "pnpm", "bun"]) {
    const direct = installGuide(pkg, { manager });
    assert.match(direct.code, /sqlite3@npm:@ohos-npm-ports\/sqlite3@5.1.7-7/);
    const indirect = installGuide(pkg, { manager, dependency: "indirect" });
    assert.equal(indirect.file, manager === "pnpm" ? "pnpm-workspace.yaml" : "package.json");
    if (manager === "pnpm") assert.match(indirect.code, /overrides:\n  "sqlite3": "npm:/);
    else
      assert.equal(
        JSON.parse(indirect.code).overrides.sqlite3,
        "npm:@ohos-npm-ports/sqlite3@5.1.7-7",
      );
  }
});
test("unknown platforms do not invent an upstream or install command", () => {
  const platform = enrichPackage({ name: "@ohos-npm-ports/unknown-openharmony-arm64" });
  assert.equal(platform.kind, "platform");
  assert.equal(installGuide(platform).code, null);
  const unknown = enrichPackage({ name: "@ohos-npm-ports/new-port" });
  assert.equal(unknown.kind, "unknown");
  assert.equal(evidenceFor(unknown, "1").length, 0);
});
test("curation survives live metadata and Chinese searches find relevant tools", () => {
  const current = enrichPackage(pkg);
  assert.equal(current.kind, "entry");
  assert.ok(searchPackages([current], { query: "数据库" }).length);
  const platform = enrichPackage({ name: "@ohos-npm-ports/tailwindcss-oxide-openharmony-arm64" });
  assert.equal(platform.entry, "@ohos-npm-ports/tailwindcss-oxide");
  assert.equal(searchPackages([current, platform], {}).length, 1);
  assert.equal(searchPackages([current, platform], { query: "tailwind" }).length, 1);
});
test("routes preserve context, explicit versions and legacy package links", () => {
  const state = readRoute(
    "https://example.org/?package=sqlite3&version=missing&manager=pnpm&dependency=indirect&q=数据库&category=data&status=active&kind=all",
  );
  assert.equal(state.version, "missing");
  assert.equal(state.manager, "pnpm");
  const url = routeUrl(state, "https://example.org/repo/");
  assert.equal(readRoute(url).query, "数据库");
  assert.equal(readRoute(url).version, "missing");
  assert.equal(readRoute("https://example.org/?manager=garbage").manager, "npm");
});
test("verification cannot leak from another version", () => {
  const p = {
    verification: [
      {
        version: "1",
        environment: "OHOS test",
        date: "2026-01-01",
        url: "https://example.org/test",
        result: "passed",
      },
    ],
  };
  assert.equal(evidenceFor(p, "2").length, 0);
  assert.equal(evidenceFor(p, "1").length, 1);
});

test("curated records require sources, keywords and safe entry associations", async () => {
  const { default: info } = await import("../src/package-info.json", { with: { type: "json" } });
  for (const [name, record] of Object.entries(info)) {
    assert.ok(["entry", "platform", "tool", "unknown"].includes(record.kind), name);
    assert.ok(Array.isArray(record.keywords), name);
    assert.equal(Object.hasOwn(record, "category"), false, name);
    assert.ok(record.sources.length, name);
    for (const source of record.sources) assert.ok(source.url.startsWith("https://"), name);
    if (record.entry) {
      assert.equal(record.kind, "platform");
      assert.equal(info[record.entry.replace("@ohos-npm-ports/", "")].kind, "entry");
    }
    for (const v of record.verification)
      assert.equal(evidenceFor(record, v.version).includes(v), true);
  }
});
test("malformed percent encoded paths fall back safely", () => {
  assert.equal(readRoute("https://example.org/packages/%ZZ/").package, "");
});

test("search has no type or purpose facets; platform packages are revealed only by a query", () => {
  const current = enrichPackage(pkg);
  const platform = enrichPackage({ name: "@ohos-npm-ports/tailwindcss-oxide-openharmony-arm64" });
  assert.deepEqual(searchPackages([current, platform], { kind: "all", category: "build" }), [
    current,
  ]);
  assert.deepEqual(
    searchPackages([current, platform], { query: "数据库", kind: "platform", category: "testing" }),
    [current],
  );
  assert.deepEqual(searchPackages([current, platform], { query: "tailwind" }), [platform]);
  assert.equal(installGuide(platform).code, null);
});

test("obsolete facet links retain useful context without applying hidden filters", () => {
  const old =
    "https://example.org/?package=sqlite3&version=5.1.7-7&manager=pnpm&q=数据库&status=active&kind=platform&category=testing";
  const state = readRoute(old);
  assert.equal(Object.hasOwn(state, "kind"), false);
  assert.equal(Object.hasOwn(state, "category"), false);
  const url = routeUrl(state, old);
  assert.equal(url.searchParams.has("kind"), false);
  assert.equal(url.searchParams.has("category"), false);
  assert.equal(readRoute(url).query, "数据库");
  assert.equal(readRoute(url).version, "5.1.7-7");
});
