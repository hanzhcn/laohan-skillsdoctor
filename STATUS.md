# STATUS — 工程任务接续

## 当前任务

### SKILLS-DOCTOR-RUNTIME-20261024 · 实现与验证完成，待 PR 集成

- owner：本次 Codex，会话唯一写入者；实际工作目录为 `../laohan-skillsdoctor-worktrees/runtime-evidence-20261024`，分支 `codex/skillsdoctor-runtime-evidence-20261024`，基线 `2cf8c7b30c6d93acb97f8f8223b0dfaf7234f502`。
- 目标已实现：新增宿主可见、历史注入、真实调用/结果及场景验收记录；保留原文件体检。默认不改技能/宿主配置、不装 hook、不调用模型、不自动运行技能；Web 不收命令。
- 候选：运行代码/测试摘要 `e1497b2716b7f6dd5c4d916e88b9bc19be1891f80e6b99bdd9c5333f1fe3099d`；运行证据与详情见 [本轮回执](docs/handoff/SKILLS_DOCTOR_RUNTIME_20261024.md)。状态与回执补录不改变已验运行代码。
- 已验：26 个正反例、lint、生产 build；本地 API200，非法范围400，跨源403，实际恶意 Host 对三条 API403；Chrome 生产构建筛选/搜索/调用详情/空验收状态、无控制台错误。
- 复审：GPT 实现，免费 Hy3 主体及最后三项增量分别取得 HTTP200 / stop / 有效 APPROVE，无发现。Step 超时、Hy3/DeepSeek 推理耗尽正文额度的失败均未计通过；最后经登记的 high/64000输出/180秒定点恢复完成，无收费通道。
- 已修边界：Next 规范化 URL 下实际 Host 绕过；调用后元数据变化的版本关联；目录预算与插件声明越界；diff 参数向量和失败传播；旧 UI 的文件“健康/CC不可见”改为物理入口语义。
- 未验边界：Claude 当前模型完整清单、其他项目/窗口与其他宿主运行态、Shell/exec 内采用、无充分日志/场景验收的真实业务效果；均保留未验证。实际日志大于扫描预算时显式部分覆盖，不推导没有使用。
- 运行：本任务生产预览 `http://127.0.0.1:3017`；main 工作区保持干净。该预览与待集成 worktree 正常保留，不是垃圾/残留；无远端生产部署，NOT_APPLICABLE。
- 集成：精确提交并 push 任务分支，创建 PR；本记录随后更新 PR 标识。未自动合并 main，Jeffrey 接受 UNVERIFIED。
- 下一动作：完成分支交付后，Jeffrey 可直接打开预览体验；正式目录的新版本按 PR 集成。需要验收记录按 README 显式 CLI 为具体场景记录。

## 近期流水

**2026-10-24·运行证据检查。** Claude/Codex 可见、调用/加载、指定场景验收分层落地，26 正反例与生产 API/UI 验证通过，不同模型复核完成；完整回执见 `docs/handoff/SKILLS_DOCTOR_RUNTIME_20261024.md`。当前任务卡保留待 PR 集成状态。

**2026-10-21·image-use 归属修正（use-family 安装位形态）。** Jeffrey 澄清 image-use 是其 codex 生图唯一方法、不可删。复核链路：真身 `~/.agents/use-family/image-use`（独立 git 仓 leeguooooo/image-use），三侧桥接齐全（claude→agents→use-family 穿透 + codex 直指真身），此前 eza ls 显示误导肉眼判为实体孤儿。classify 反向链分支补 `.agents/use-family` 安装位特征（第六种真身位置，与 paseo-plugins 同性质：安装位真身原地更新）。实测 orphan 0（全生态 577 零孤儿）、tool-managed 10。链路零改动（生图功能未触碰）。

**2026-10-21·形态判定重构 + 双生态盲区补强（commit 641c8f3 + 本批）。** 主会话 Claude（Jeffrey 指派）。① 前批 GOVERNED_SKILLS 硬编码名单（仅 3 项）+ 名字前缀法不完备，glm-chat/deepseek-chat 等治理 skill 仍掉 orphan 被当清理候选——重构为按形态判定：agents 实体+非 lock/plugin → governed（治理·正常）或自研治理仓实体（laohan-/cheat- 前缀）；lock/plugin 判定提前修掉 npx 真身被前缀分支误吞的顺序 bug；brokenLink 收紧为"agents 实体+git 仓同名并存"（真双份漂移源），治理真身不报。实测 orphan 91→1（仅 image-use 独立 git clone 真孤儿）。② 生态操作：按体检结果补桥 4 个（dbs-content-value/laohan-duopingtai/laohan-jiaozhun/ui-sketcher，claude→agents 相对链，系统确认即时生效）；source-command-*×51 拍板不桥（自述宿主能力未验证+ECC 命令重复，桥接徒增污染）。③ 盲区补强：scanner names 收集增 openclawSkills/codexSkills（README 承诺 OpenClaw 双生态但 33 个 openclaw 独有 + 1 个 codex 独有 playwright 原不可见），classify 增单宿主独有分支（openclaw-独有/codex-独有），types/scanner 增 openclaw PathInfo；notInCC 抑制机制落地（内置 source-command- 前缀 + 外部名单 ~/.agents/.skd-ignore-notcc）。验证：tsc 零错误；dev 实测总数 544→577、openclaw 15→47、tool-managed 8→9、notInCC 51→0（全量=source-command×51 正确抑制，算术闭合 56=1adapters+4已桥+51）；handoff duplicateCopy（claude-mem 插件副本内容不一致）持续检出。dev 已停。遗留观察：image-use（独立 git clone v0.34.0）归 orphan 属知情提示，是否纳入登记体系由 owner 定。

**2026-10-21·分类模型修复（classify 三新形态 + codex 数据源 + brokenLink）。** 主会话 Claude（S8169 评估续接）。修复背景：规则基线停留 skills.md v1.3，不认识反向链/治理仓实体/dbskill 三种 6 月后新形态，91 个孤儿中大半误报。改动 9 文件：types（Origin 增 dbskill/tool-managed，Health 增 brokenLink，Skill 增 codex PathInfo）、paths（增 dbsRepo/codexSkills）、classify（重构判定链：repo 链接→工具管理反向链（含 paseo-plugins/codex 真身路径）→dbskill（dbs 前缀+repo 存在）→治理仓实体白名单→链断自研副本（前缀+agents real）→lock/plugin→orphan；导出 GOVERNED_SKILLS/repoForOrigin）、health（isBrokenLink：自研 agents 实体=链断（治理仓白名单豁免）；drift 重构为仅实体副本 vs repo diff，扩展覆盖 cheat-on-content；driftDiff 签名增 origin）、scanner（codex PathInfo 采集 + summarize 新 origin/health 计数）、origin-meta（新 origin/brokenLink 标签）、page.tsx（8 卡片/3 新 tab/codex 列/链断副本统计）、skill-detail（codex 状态格）、API skill route（driftDiff 新签名）。验证：tsc --noEmit 零错误；npm run build 全过（lint 预存 2 个 react-hooks/set-state-in-effect 错误与本次无关未动）；dev 实测 /api/scan：orphan 91→60（残留全部为 source-command-*×52 真野生副本 + 8 个 agents real/claude symlink 野生形态），新增 dbskill 34/tool-managed 8（paseo×6+ui-sketcher+paseo-progress）/brokenLink 9（治理系列实体副本，与 84378 定性一致——真实卫生问题非误报）；详情 API codex 字段正常；Paseo 浏览器 DOM 快照验证 8 卡片/新 tab/codex 列/健康徽章全部渲染。dev 已停，恢复按 skill-doctor.md 规则启动。已知未做（原方案 ④）：notInCC 白名单机制（Codex 专用 skill 甄别）——当前 notInCC 55 中 52 个是 source-command 孤儿的伴生告警，先修孤儿归属即可大幅收敛，未单独建白名单。

**2026-10-21·治理入口补齐。** 保留 Next.js 注意事项和 CLAUDE.md 指针，追加 STATUS 接续及项目合同 TODO；未改产品代码或声明业务构建/部署通过。

## 历史索引

无；后续详细回执按需写 docs/handoff/。
