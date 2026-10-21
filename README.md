# laohan-skillsdoctor

> 原名 skill-doctor，2026-10 起更名为 laohan-skillsdoctor。

> Claude Code / OpenClaw **skill 体检仪表盘** —— 一目了然看清你的 skills 来自哪里、有没有污染/漂移/孤儿。

[English](./README.en.md) · 简体中文

## 为什么做

用 Claude Code / OpenClaw 一段时间后，`~/.agents/skills` 和 `~/.claude/skills` 会堆出几百个 skill，来自四面八方：自己写的、`npx skills add` 装的、ECC 等插件自带的、OpenClaw 自带的……还会被某次操作批量塞进一堆**插件 skill 副本**（污染），或者自研 skill 的本地副本和 git 仓库**双向漂移**（你改了本地没推、仓库改了没拉，CC 一直读旧版）。

现成的 skill 管理器（jiweiyeah/Skills-Manager 等）都是"入库分发"或"手动打标签"，**没有一个自动按来源分类、检测污染/漂移/孤儿**。laohan-skillsdoctor 把这套审计逻辑产品化。

## 功能

- **自动来源分类**：自研（laohan/cheat）/ npx / 插件副本 / OpenClaw / 孤儿，一眼看清
- **健康检查**：
  - 🔴 失效链接（dangling symlink）
  - 🔴 CC 不可见（agents 有但 claude 没）
  - 🟡 插件副本（和插件 skill 同名，可能是污染）
  - 🟡 双份实体（agents + claude 都是实体，漂移温床）
  - 🟡 漂移（自研 skill 的本地 vs git 仓库 diff）
- **详情视图**：路径状态、npx 锁文件元数据、插件原件路径、漂移 diff、SKILL.md 预览

## 安装

```bash
git clone https://github.com/hanzhcn/laohan-skillsdoctor.git
cd laohan-skillsdoctor
npm install
npm run dev
# 打开 http://localhost:3000
```

纯本地运行，只读扫描你的 skills 目录，不修改任何文件。

## 数据源

| 来源 | 路径 |
|------|------|
| agents 真身 | `~/.agents/skills/` |
| CC 桥接层 | `~/.claude/skills/` |
| npx 锁文件 | `~/.agents/.skill-lock.json` |
| 插件清单 | `~/.claude/plugins/installed_plugins.json` |
| 自研 git | `~/Documents/laohan-skills/` |
| cheat git | `~/Documents/cheat-on-content/skills/` |
| OpenClaw | `~/.openclaw/skills/` |

## 分类规则

1. symlink 指向 `Documents/laohan-skills` → 自研 laohan
2. symlink 指向 `cheat-on-content` → 自研 cheat
3. symlink 指向 `.openclaw/skills` → OpenClaw
4. `.skill-lock.json` 有记录 → npx
5. 与某插件 skills/ 同名 → 插件副本
6. 以上都不是 → 孤儿 ⚠️

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn/ui

## 路线图

- [x] 只读体检（扫描/分类/健康检查/详情）
- [ ] 写操作（删除副本/转 symlink/同步仓库，带二次确认）
- [ ] 更新检测（git fetch / skillFolderHash 比对）
- [ ] Tauri 桌面打包

## License

MIT
