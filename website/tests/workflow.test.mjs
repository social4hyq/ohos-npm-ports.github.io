import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "vite-plus/test";
const workflow = readFileSync(
  new URL("../../.github/workflows/website.yml", import.meta.url),
  "utf8",
);
const condition = workflow.match(/\n  deploy:\n    if: \$\{\{ (.+) \}\}/)?.[1];
const upstream = "ohos-npm-ports/ohos-npm-ports.github.io";
function canDeploy({
  repository = upstream,
  event = "push",
  ref = "refs/heads/main",
  result = "success",
  cancelled = false,
} = {}) {
  assert.ok(condition, "deploy must have an explicit job condition");
  return runInNewContext(condition, {
    github: { repository, event_name: event, ref },
    needs: { build: { result } },
    cancelled: () => cancelled,
  });
}
test("forks validate without attempting Pages deployment", () => {
  for (const event of ["push", "workflow_dispatch", "schedule", "repository_dispatch"])
    assert.equal(canDeploy({ repository: "social4hyq/ohos-npm-ports.github.io", event }), false);
});
test("upstream main can deploy after successful build, including skipped freshness jobs", () => {
  for (const event of ["push", "workflow_dispatch", "schedule", "repository_dispatch"])
    assert.equal(canDeploy({ event }), true);
});
test("PRs, other branches, failed builds and cancelled runs never deploy", () => {
  for (const options of [
    { event: "pull_request" },
    { ref: "refs/heads/feature" },
    { result: "failure" },
    { result: "skipped" },
    { cancelled: true },
  ])
    assert.equal(canDeploy(options), false);
});
