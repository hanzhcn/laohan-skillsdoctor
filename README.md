# laohan-skillsdoctor

> 原名 skill-doctor，2026-10 起更名为 laohan-skillsdoctor。

> Claude Code / Codex / OpenClaw **skill 体检仪表盘** —— 一目了然看清你的 skills 来自哪里、有没有污染/漂移/孤儿。

[English](./README.en.md) · 简体中文

## 为什么做

用 Claude Code / OpenClaw 一段时间后，`~/.agents/skills` 和 `~/.claude/skills` 会堆出几百个 skill，来自四面八方：自己写的、`npx skills add` 装的、ECC 等插件自带的、OpenClaw 自带的……还会被某次操作批量塞进一堆**插件 skill 副本**（污染），或者自研 skill 的本地副本和 git 仓库**双向漂移**（你改了本地没推、仓库改了没拉，CC 一直读旧版）。

现成的 skill 管理器（jiweiyeah/Skills-Manager 等）都是"入库分发"或"手动打标签"，**没有一个自动按来源分类、检测污染/漂移/孤儿**。laohan-skillsdoctor 把这套审计逻辑产品化。

## 功能

- **自动来源分类**：自研（laohan/cheat）/ dbskill / 工具管理 / 治理真身 / npx / 插件副本 / OpenClaw / 孤儿，一眼看清
- **技能运行证据**：分别展示当前宿主目录、历史注入、真实调用/读取与场景验收；文件健康不等于模型已看到或有效执行
- **健康检查**：
  - 🔴 失效链接（dangling symlink）
  - 🔴 CC 缺桥接入口（agents 有但 claude 没；仅文件层检查，不据此推断模型不可见；`source-command-*` 与自定义忽略名单豁免）
  - 🟡 插件副本（和插件 skill 同名，标注 SKILL.md 逐字一致/有差异）
  - 🟡 双份实体（agents + claude 都是实体，漂移温床）
  - 🟡 漂移（自研 skill 的本地 vs git 仓库 SKILL.md diff）
  - 🟡 链断副本（自研 skill 以实体存在，未按规范 symlink 到 git 仓库；仅当 git 仓有同名 skill 时标记，治理仓真身不报）
- **详情视图**：agents / claude / codex 路径状态、npx 锁文件元数据、插件原件路径、漂移 diff、SKILL.md 预览

## 安装

```bash
git clone https://github.com/hanzhcn/laohan-skillsdoctor.git
cd laohan-skillsdoctor
npm install
npm run dev
# 打开 http://localhost:3000
```

默认仅监听 `127.0.0.1`，网页只读扫描，不修改技能、宿主配置或会话日志，不调用模型、不自动运行技能脚本。

## 运行证据如何判断

| 层级 | 证据与状态 | 不做的推断 |
|------|-----------|-----------|
| 宿主可见 | Codex 原生 `app-server` 的 `initialize` / `skills/list` 目录协议，区分列出、关闭、未列出、探测失败；Claude / Codex 保存记录中的宿主注入另列时间 | 目录可达不等于当前会话已注入；本次 app 所在目录的清单不代表其他项目 |
| 实际调用 | Claude `Skill`、结构化 `Read` 调用与对应 tool result；按宿主/会话/调用 ID 去重；错误、无结果、返回待确认分开 | 聊天提及不算调用；读取成功不证明遵守技能；同名多版本不强行分摊 |
| 有效执行 | 绑定真实调用、加载正文与当前版本、文件 SHA-256、具体场景及验收命令结果的本地记录 | 加载成功不算业务有效；一次场景通过不证明所有任务都有效；文件变化后旧验收过期 |

- Claude 当前支持主配置全局目录/已登记插件；其他 Claude 配置的共享日志无法确定配置归属，按“Claude 系列历史证据”展示。未拿到当前 Claude 模型完整列表时显示“当前列表未验证”。
- Codex 调用证据只识别结构化读取工具，不猜测 Shell / `exec` 脚本内是否采用技能；OpenClaw 等其他宿主运行态尚未接入。
- 最近 7/30/90 天可选；日志枚举按修改时间筛选，再按事件时间过滤。默认读取总上限 20 秒、1 GiB、3000 文件，单行 8 MiB；超限、坏行、权限问题均明确显示部分覆盖，不能把零记录解释成未使用。刷新合并缓存 30 秒。
- 文件目录遍历上限 3 秒、10000 目录、64 层，超限公开；插件组件声明须在其安装目录内，外部真源可通过既有软链到达。三条本地 API 都检查实际 Host、端口、Origin 和跨站标记，避免 Next.js 规范化 URL 后误放行外部来源。
- 网页仅返回调用 ID、工具名、时间、路径、计数和摘要，不返回聊天正文、思维链、模型请求、命令参数或输出。原有文件体检单独保留。

### 记录一次场景验收

先在宿主真实使用技能，再运行你为产物选择的验收程序。详情里可查会话 ID、调用 ID 与真实技能路径：

```bash
npm run verify:skill -- --help
npm run verify:skill -- \
  --skill /absolute/path/to/SKILL.md \
  --host claude --session SESSION_ID --call CALL_ID \
  --scenario "本次任务产物满足哪些具体条件" \
  --check-name "项目回归检查" \
  --timeout-seconds 60 \
  -- npm test
```

Web API 不接受或执行命令。此 CLI 仅在明确启动时执行给定程序，不经 shell 展开；要求加载正文与当前版本完全一致，动态替换无法匹配时拒绝。POSIX 上超时回收本次验收的进程组，单次 1–300 秒，输出总量上限 8 MiB。通过、非零退出和超时均保存记录到 `~/.agents/skillsdoctor/evidence/`；不保存命令参数或输出正文。记录为本地证据，不提供防篡改认证，场景判据和人的接受仍由任务定义。

技能文件变更后旧记录显示过期；调用后文件修改时间更新（即使只改元数据）、历史日志缺失、调用失败、只有名称无法绑定版本或缺少验收记录时，保持未验证。路径按本次文件系统解析，历史软链曾指向何处没有完整快照；这些是保守的本地版本关联，不是不可伪造的历史证明。不会为了显示绿色而自动调用模型或执行所有已安装技能。

## 开发验证

```bash
npm test
npm run lint
npm run build
```

## 数据源

| 来源 | 路径 |
|------|------|
| agents 真身 | `~/.agents/skills/` |
| CC 桥接层 | `~/.claude/skills/` |
| npx 锁文件 | `~/.agents/.skill-lock.json` |
| 插件清单 | `~/.claude/plugins/installed_plugins.json` |
| 自研 git | `~/Documents/laohan-skills/` |
| cheat git | `~/Documents/cheat-on-content/skills/` |
| dbskill git | `~/Documents/dbskill/skills/` |
| Codex | `~/.codex/skills/` |
| OpenClaw | `~/.openclaw/skills/` |

> 三个自研仓路径是作者本机的目录布局，可在 `lib/paths.ts` 中改成你的路径。目录不存在时，相关分类、漂移与链断检查会自动跳过。

## 分类规则

1. 仅 OpenClaw / 仅 Codex 层存在 → OpenClaw 自带 / 工具管理（Codex 安装位）
2. symlink 指向 `Documents/laohan-skills` → 自研 laohan
3. symlink 指向 `cheat-on-content` → 自研 cheat
4. symlink 指向 `.openclaw/skills` → OpenClaw
5. symlink 指向 `.claude/skills`、`.codex/skills` 或 `paseo-plugins` → 工具管理
6. `dbs*` 且 dbskill 仓有同名 skill → dbskill
7. `.skill-lock.json` 有记录 → npx
8. 与某插件 skills/ 同名 → 插件副本
9. agents 实体：`laohan-*` → 自研 laohan（治理真身），`cheat-*` → 自研 cheat，其余 → 治理真身
10. 以上都不是 → 孤儿 ⚠️

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn/ui

## 路线图

- [x] 只读体检（扫描/分类/健康检查/详情）
- [ ] 写操作（删除副本/转 symlink/同步仓库，带二次确认）
- [ ] 更新检测（git fetch / skillFolderHash 比对）
- [ ] Tauri 桌面打包

## License

MIT
