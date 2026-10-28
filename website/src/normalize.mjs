import { enrichPackage } from "./catalog.mjs";
export function normalizePackage(metadata, source = {}) {
  const version = metadata["dist-tags"]?.latest ?? null;
  const current = metadata.versions?.[version] ?? {};
  const deprecated = current.deprecated || null;
  const retained = Object.fromEntries(
    [
      "kind",
      "category",
      "keywords",
      "notes",
      "verification",
      "sources",
      "entry",
      "installPolicy",
      "nativeSupport",
      "runtime",
      "architecture",
    ]
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
  return enrichPackage({
    ...retained,
    name: metadata.name,
    shortName: metadata.name.replace("@ohos-npm-ports/", ""),
    upstream: source.upstream ?? null,
    directories: source.directories ?? [],
    description:
      current.description || metadata.description || source.description || "暂无包描述。",
    version,
    deprecated,
    status: deprecated ? "deprecated" : version ? "active" : "untagged",
    license: typeof current.license === "string" ? current.license : (source.license ?? null),
    publishedAt:
      metadata.time?.[version] ??
      (version === source.version ? (source.publishedAt ?? null) : null),
    versions: Object.keys(metadata.versions ?? {})
      .map((v) => ({
        version: v,
        tags: Object.keys(metadata["dist-tags"] ?? {}).filter(
          (t) => metadata["dist-tags"][t] === v,
        ),
        deprecated: metadata.versions[v].deprecated || null,
      }))
      .reverse(),
  });
}
