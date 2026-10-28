# 包信息维护

`src/package-info.json` 是网站的人工维护资料，不改变 ports 构建或 npm 发布。

- `kind`：entry（用户入口）、platform（自动引用的平台槽位）、tool（辅助工具）、unknown。默认隐藏平台槽位，搜索可找到它们。
- `category`、`keywords`：用途与中文检索词。以源码、包描述为依据，不等于兼容承诺。
- `entry`：平台槽位的完整入口包名。必须有 loader / optionalDependencies 来源，不能只按名字猜；没有确认关系就不填。
- `sources`：资料来源，使用固定 commit 的源码链接，或 npm 包页面。更新资料时复核来源仍支持相关表述。
- `notes`：`text`、`url`、可选的精确 `version`。版本特有的限制必须带版本，避免误套到其他发布。
- `verification`：每项必须带精确 `version`、`environment`（设备/系统/运行时）、`date`、`result` 和公开 HTTPS 证据 `url`。只展示与所选版本对应的记录；发布成功、CI 脚本存在或网站测试成功均不能充当真机通过。
- `runtime`、`architecture`：没有资料时不要填写，前端显示“未记录”。
- `nativeSupport`：`text` 和官方来源 `url`；只有核实上游原生支持及迁回方式后才填写。
- `installPolicy: manual`：必须专门接线的辅助包不生成通用 alias。

新发现包不自动推断上游别名、入口关联或验证结果。实时版本刷新保留人工资料。npm 元数据中 latest 未废弃只代表发布状态。

## 安装配置依据

- npm / Bun 的间接依赖使用根 `package.json` 的 overrides：
  [npm 文档](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)、[Bun 文档](https://bun.sh/docs/pm/overrides)。
- pnpm 的 overrides 写在根 `pnpm-workspace.yaml`：
  [pnpm 文档](https://pnpm.io/settings#overrides)。
- 配置只用于间接依赖；已有直接依赖用 alias，不生成会触发 npm EOVERRIDE 的混合配置。

## 静态页面和缓存

构建插件以同一包数据、安装生成器输出首页和 `packages/<shortName>/index.html`，无 JavaScript 可读。启用 JavaScript 后由 Vue 增强为交互目录。兼容旧 `?package=` 链接；版本、包管理器、依赖类型和筛选保存在查询参数。

`SITE_ORIGIN` 可覆盖 canonical 来源，默认按 `GITHUB_REPOSITORY` 的 owner 生成 GitHub Pages 域名；路径由现有 `pagesBase` 统一决定。构建同时产生 sitemap 和 robots。

registry 的 compact/full 响应分开缓存五分钟，复用进行中请求；存储失败不影响访问，手动刷新跳过已完成的缓存。包查询全局最多四并发，详情排队优先；新包发现失败不清空目录。

## 验证

`pnpm run check && pnpm test && pnpm run sync-data && pnpm run build && pnpm run test:e2e`

CI 分别验证域名根路径、仓库子路径；浏览器覆盖桌面/手机、分享与历史导航、缓存、失败恢复及禁用 JavaScript。此工作只在 fork PR 验证，不代表对包逐一真机验收。
