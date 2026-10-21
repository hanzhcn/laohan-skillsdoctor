# STATUS — 工程任务接续

## 当前任务

无待续任务。SKILL-DOCTOR-MAINTENANCE 分类模型修复批已交付（见近期流水），下一批按需领取。

## 近期流水

**2026-10-21·分类模型修复（classify 三新形态 + codex 数据源 + brokenLink）。** 主会话 Claude（S8169 评估续接）。修复背景：规则基线停留 skills.md v1.3，不认识反向链/治理仓实体/dbskill 三种 6 月后新形态，91 个孤儿中大半误报。改动 9 文件：types（Origin 增 dbskill/tool-managed，Health 增 brokenLink，Skill 增 codex PathInfo）、paths（增 dbsRepo/codexSkills）、classify（重构判定链：repo 链接→工具管理反向链（含 paseo-plugins/codex 真身路径）→dbskill（dbs 前缀+repo 存在）→治理仓实体白名单→链断自研副本（前缀+agents real）→lock/plugin→orphan；导出 GOVERNED_SKILLS/repoForOrigin）、health（isBrokenLink：自研 agents 实体=链断（治理仓白名单豁免）；drift 重构为仅实体副本 vs repo diff，扩展覆盖 cheat-on-content；driftDiff 签名增 origin）、scanner（codex PathInfo 采集 + summarize 新 origin/health 计数）、origin-meta（新 origin/brokenLink 标签）、page.tsx（8 卡片/3 新 tab/codex 列/链断副本统计）、skill-detail（codex 状态格）、API skill route（driftDiff 新签名）。验证：tsc --noEmit 零错误；npm run build 全过（lint 预存 2 个 react-hooks/set-state-in-effect 错误与本次无关未动）；dev 实测 /api/scan：orphan 91→60（残留全部为 source-command-*×52 真野生副本 + 8 个 agents real/claude symlink 野生形态），新增 dbskill 34/tool-managed 8（paseo×6+ui-sketcher+paseo-progress）/brokenLink 9（治理系列实体副本，与 84378 定性一致——真实卫生问题非误报）；详情 API codex 字段正常；Paseo 浏览器 DOM 快照验证 8 卡片/新 tab/codex 列/健康徽章全部渲染。dev 已停，恢复按 skill-doctor.md 规则启动。已知未做（原方案 ④）：notInCC 白名单机制（Codex 专用 skill 甄别）——当前 notInCC 55 中 52 个是 source-command 孤儿的伴生告警，先修孤儿归属即可大幅收敛，未单独建白名单。

**2026-10-21·治理入口补齐。** 保留 Next.js 注意事项和 CLAUDE.md 指针，追加 STATUS 接续及项目合同 TODO；未改产品代码或声明业务构建/部署通过。

## 历史索引

无；后续详细回执按需写 docs/handoff/。
