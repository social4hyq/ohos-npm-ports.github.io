import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  enrichPackage,
  installGuide,
  kindLabels,
  statusLabels,
  evidenceFor,
} from "../src/catalog.mjs";
export const escapeHtml = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const link = (url, label) =>
  (url || "").startsWith("https://")
    ? `<a href="${escapeHtml(url)}">${escapeHtml(label)} ↗</a>`
    : escapeHtml(label);
export function pageMetadata({
  title,
  description,
  path = "",
  base = "/",
  siteOrigin = "https://ohos-npm-ports.github.io",
}) {
  const canonical = new URL(`${base}${path}`, siteOrigin).href;
  return `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary">`;
}
export function renderCatalog(packages, base = "/") {
  return `<main class="shell static-content"><h1>OpenHarmony npm 包目录</h1><p>优先使用上游原生支持。以下为构建时快照，启用 JavaScript 可搜索和实时刷新。</p><ul>${packages
    .map(enrichPackage)
    .map(
      (p) =>
        `<li><a href="${base}packages/${encodeURIComponent(p.shortName)}/">${escapeHtml(p.shortName)}</a> · ${escapeHtml(p.version)} · ${kindLabels[p.kind]}<p>${escapeHtml(p.description)}</p></li>`,
    )
    .join("")}</ul></main>`;
}
export function renderPackage(source, base = "/") {
  const p = enrichPackage(source);
  const guides = ["npm", "pnpm", "bun"]
    .map((manager) =>
      ["direct", "indirect"]
        .map((dependency) => {
          const g = installGuide(p, { manager, dependency });
          return `<details${manager === "npm" && dependency === "direct" ? " open" : ""}><summary>${manager} · ${dependency === "direct" ? "直接" : "间接"}依赖</summary><p>${escapeHtml(g.file)}</p><pre tabindex="0">${escapeHtml(g.code || g.note)}</pre><p>${escapeHtml(g.note)}</p></details>`;
        })
        .join(""),
    )
    .join("");
  const verification = evidenceFor(p, p.version);
  const records = verification.length
    ? verification
        .map(
          (v) =>
            `<p>${link(v.url, `${v.version} · ${v.environment} · ${v.date} · ${v.result}`)}</p>`,
        )
        .join("")
    : "<p>所选版本的真机验证：未记录。发布状态和网站 CI 不代表真机验收通过。</p>";
  const notes = (p.notes || []).filter((n) => !n.version || n.version === p.version);
  return `<main class="shell static-content"><nav><a href="${base}">← 返回包目录</a> · <a href="${base}?package=${encodeURIComponent(p.name)}">打开交互详情</a></nav><h1>${escapeHtml(p.shortName)}</h1><p>${escapeHtml(p.description)}</p><p>${escapeHtml(p.version)} · ${kindLabels[p.kind]} · ${escapeHtml(statusLabels[p.status])}</p><p>${link(`https://www.npmjs.com/package/${p.name}`, "npm 包")} ${p.upstream ? link(`https://www.npmjs.com/package/${p.upstream}`, "上游包") : ""}</p><h2>兼容性与限制</h2><p>包声明的运行时：${escapeHtml(p.runtime || "未记录")} · CPU：${escapeHtml(p.architecture || "未记录")}</p>${records}${notes.length ? notes.map((n) => `<p>${escapeHtml(n.text)} ${link(n.url, "来源")}</p>`).join("") : "<p>所选版本的已知限制：未记录，请在目标设备验证。</p>"}${(p.sources || []).map((s) => `<p>${link(s.url, s.label)}</p>`).join("")}${p.nativeSupport ? `<p>${link(p.nativeSupport.url, p.nativeSupport.text)}</p>` : ""}${p.kind === "platform" ? `<p>平台子包通常由入口自动安装。${p.entry ? `<a href="${base}packages/${encodeURIComponent(p.entry.replace("@ohos-npm-ports/", ""))}/">查看入口包 ${escapeHtml(p.entry)}</a>` : "入口关联未记录，请查阅包文档。"}</p>` : ""}<h2>接入配置</h2>${guides}<p>将配置合并到现有文件，不要覆盖其他字段。npm / pnpm 安装原生模块后可能需要 ${link("https://www.npmjs.com/package/ohos-signpost", "ohos-signpost")} 签名；Harmonybrew 的 Bun 已内置签名。安装后仍需在目标设备验证加载与运行。</p></main>`;
}
export async function generateStatic({
  outDir,
  base = "/",
  siteOrigin = "https://ohos-npm-ports.github.io",
}) {
  const data = JSON.parse(await readFile(join(outDir, "data.json"), "utf8"));
  const template = await readFile(join(outDir, "index.html"), "utf8");
  const page = (content, meta) =>
    template
      .replace(/<title>[\s\S]*?<\/title>/, "")
      .replace(/<meta\s+name="description"[\s\S]*?>/, "")
      .replace("</head>", `${pageMetadata({ ...meta, base, siteOrigin })}</head>`)
      .replace('<div id="app"></div>', `<div id="app">${content}</div>`)
      .replace(/<noscript[\s\S]*?<\/noscript>/, "");
  const urls = [new URL(base, siteOrigin).href];
  await writeFile(
    join(outDir, "index.html"),
    page(renderCatalog(data.packages, base), {
      title: "ohos-npm-ports · OpenHarmony npm 包目录",
      description: "查找社区移植包、版本、接入配置及兼容性说明。",
    }),
  );
  for (const p of data.packages) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(p.shortName))
      throw Error(`Unsafe package path: ${p.shortName}`);
    const path = `packages/${p.shortName}/`;
    const directory = join(outDir, path);
    await mkdir(directory, { recursive: true });
    const html = page(renderPackage(p, base), {
      title: `${p.shortName} · OpenHarmony 接入说明`,
      description: p.description,
      path,
    });
    await writeFile(
      join(directory, "index.html"),
      html.replace('href="./favicon.svg"', `href="${base}favicon.svg"`),
    );
    urls.push(new URL(`${base}${path}`, siteOrigin).href);
  }
  await writeFile(
    join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeHtml(url)}</loc></url>`).join("")}</urlset>`,
  );
  await writeFile(
    join(outDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${new URL(`${base}sitemap.xml`, siteOrigin).href}\n`,
  );
}
