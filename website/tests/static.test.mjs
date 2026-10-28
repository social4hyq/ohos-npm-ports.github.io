import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  renderCatalog,
  renderPackage,
  pageMetadata,
  escapeHtml,
} from "../scripts/static-pages.mjs";
const pkg = {
  name: "@ohos-npm-ports/sqlite3",
  shortName: "sqlite3",
  upstream: "sqlite3",
  version: "5.1.7-7",
  versions: [{ version: "5.1.7-7" }],
  description: "<img src=x onerror=alert(1)>",
  kind: "entry",
};
test("static pages provide escaped package content and shared installation guides without JS", () => {
  const html = renderPackage(pkg, "/repo/");
  assert.ok(html.includes("npm install sqlite3@npm:@ohos-npm-ports/sqlite3@5.1.7-7"));
  assert.ok(html.includes("pnpm-workspace.yaml"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(renderCatalog([pkg], "/repo/").includes("/repo/packages/sqlite3/"));
  assert.equal(escapeHtml('"<&'), "&quot;&lt;&amp;");
});
test("canonical and metadata respect deployment base and escape attributes", () => {
  const html = pageMetadata({
    title: 'x"<',
    description: 'x"<',
    path: "packages/sqlite3/",
    base: "/repo/",
    siteOrigin: "https://example.org",
  });
  assert.ok(html.includes("https://example.org/repo/packages/sqlite3/"));
  assert.ok(html.includes('name="description" content="x&quot;&lt;"'));
});
