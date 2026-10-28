import info from "./package-info.json" with { type: "json" };
export const statusLabels = {
  all: "全部发布状态",
  active: "latest 未废弃",
  deprecated: "已废弃",
  untagged: "无 latest 标签",
};
export function enrichPackage(pkg) {
  const curated = info[pkg.name.replace("@ohos-npm-ports/", "")] || {};
  return {
    kind: /(?:openharmony-arm64|linux-arm64-ohos)$/.test(pkg.name) ? "platform" : "unknown",
    keywords: [],
    notes: [],
    verification: [],
    ...pkg,
    ...curated,
  };
}
export function evidenceFor(pkg, version) {
  return (pkg.verification || []).filter(
    (v) =>
      v.version === version &&
      v.environment &&
      /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
      v.url?.startsWith("https://") &&
      v.result,
  );
}
export function installGuide(
  pkg,
  { manager = "npm", dependency = "direct", version = pkg.version } = {},
) {
  if (pkg.installPolicy === "manual")
    return {
      file: null,
      code: null,
      note: "此包需要专门接线，请按下方移植说明配置，不能用通用 alias 替换。",
    };
  if (pkg.kind === "platform")
    return {
      file: null,
      code: null,
      note: pkg.entry
        ? "平台子包由入口包自动引用，请使用下方入口链接。"
        : "尚未确认对应入口，请查阅包文档；不要直接替换业务依赖。",
    };
  if (!version || !pkg.versions?.some((v) => v.version === version))
    return { file: null, code: null, note: "该版本未在当前数据中找到，请确认版本信息后再复制。" };
  const spec = `${pkg.name}@${version}`;
  if (dependency === "direct")
    return {
      file: "终端",
      code: `${manager === "npm" ? "npm install" : `${manager} add`} ${pkg.upstream ? `${pkg.upstream}@npm:` : ""}${spec}`,
      note: pkg.upstream
        ? "在项目目录执行；npm alias 保留原来的 import 名称。"
        : "尚未确认上游映射；此命令安装 scope 包本身，不保证保留原来的 import 名称。",
    };
  if (!pkg.upstream)
    return { file: null, code: null, note: "尚未确认上游包名，不生成猜测的 overrides。" };
  const target = `npm:${spec}`;
  return {
    file: manager === "pnpm" ? "pnpm-workspace.yaml" : "package.json",
    code:
      manager === "pnpm"
        ? `overrides:\n  ${JSON.stringify(pkg.upstream)}: ${JSON.stringify(target)}`
        : JSON.stringify({ overrides: { [pkg.upstream]: target } }, null, 2),
    note: `合并到项目根目录的现有配置，不要覆盖其他字段；然后执行 ${manager} install。仅用于间接依赖。`,
  };
}
export function searchPackages(packages, { query = "", status = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return packages
    .filter((p) => (status === "all" || p.status === status) && (q || p.kind !== "platform"))
    .map((pkg) => ({
      pkg,
      rank: q
        ? [pkg.name, pkg.upstream, (pkg.keywords || []).join(" "), pkg.description].findIndex((t) =>
            t?.toLowerCase().includes(q),
          )
        : 0,
    }))
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.pkg);
}
const allow = (value, values, fallback) => (values.includes(value) ? value : fallback);
export function readRoute(input) {
  const url = new URL(input),
    p = url.searchParams;
  const path = url.pathname.match(/\/packages\/([^/]+)\/?$/);
  let pathName = "";
  try {
    pathName = path ? decodeURIComponent(path[1]) : "";
  } catch {
    /* malformed URLs fall back to catalog */
  }
  return {
    package: p.get("package") || pathName,
    version: p.get("version") || "",
    manager: allow(p.get("manager"), ["npm", "pnpm", "bun"], "npm"),
    dependency: allow(p.get("dependency"), ["direct", "indirect"], "direct"),
    query: p.get("q") || "",
    status: allow(p.get("status"), Object.keys(statusLabels), "all"),
  };
}
export function routeUrl(state, base) {
  const url = new URL(base);
  url.searchParams.delete("kind");
  url.searchParams.delete("category");
  const defaults = {
    manager: "npm",
    dependency: "direct",
    status: "all",
  };
  for (const [key, alias] of Object.entries({
    package: "package",
    version: "version",
    manager: "manager",
    dependency: "dependency",
    query: "q",
    status: "status",
  })) {
    if (state[key] && state[key] !== defaults[key]) url.searchParams.set(alias, state[key]);
    else url.searchParams.delete(alias);
  }
  return url;
}
