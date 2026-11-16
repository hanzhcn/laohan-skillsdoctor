# 对抗复审回执 — laohan-skillsdoctor PR #1

- 复审形态: **TOOLED**（对象含可执行代码，全部结论来自实测；依据 laohan-review SKILL.md 对抗审查方法）
- 时间: 2026-11-17 | 复审官: 独立窗口（未参与实现）
- 对象: `pr-1-runtime-evidence` (ac564d5) vs `main` (158120d)，30 文件 +1173/-35
- 工具: /tmp/adv-test-pr1.mts（34 断言）+ 临时 dev 实例 (127.0.0.1:3457，已停止) + curl HTTP 矩阵 + grep
- 硬边界遵守: 未改仓库文件/未 commit/未合并/未外发；临时脚本仅 /tmp；npm install 未执行

## 结论: **可合入 main**（0×P0-P2，3×P3 记录性观察项，均不阻塞）

## 对抗性尝试记录

### 1. 安全声明证伪（Host/Origin/sec-fetch-site/URL 规范化）
单元矩阵 18 项 + HTTP 实测 9 项：
- 反例全拦：`Host: evil.com` / `localhost.evil.com` / `evil.localhost` / `127.0.0.1.evil.com` / userinfo / url 主机 evil 而 Host 伪造 localhost（Next 规范化差异场景）/ 端口不匹配 / 跨源 Origin / `origin: null`（sandbox iframe）/ `sec-fetch-site: cross-site` → 全部 403/false（单元 PASS，HTTP 实测 403 ×5）
- 正例放行：localhost / 127.0.0.1 / `[::1]` IPv6 / 大写 `LOCALHOST`（HTTP 实测 200）——IPv6 疑点排除：WHATWG URL `hostname` 对 IPv6 返回带方括号 `[::1]`，与白名单匹配，代码正确（复审官初版预期有误，实测纠正）
- **F1 (P3)**: 前导零端口 `Host: localhost:03000` 放行（单元+HTTP 双实测）。威胁评估：浏览器按真实端口发 Host 不发前导零；能任意伪造 Host 头的攻击者直接用标准 `localhost:3000` 同样通过——前导零非绕过必要路径，不构成新增攻击面。建议后续注释说明或字符串级比对端口，不阻塞。
- **F2 (P3 观察)**: Origin 缺失 + 无 sec-fetch-site 的老客户端（no-cors，Chrome<89/Safari<16.4）可读本机技能清单。现代浏览器全覆盖；服务仅绑 127.0.0.1；数据敏感度低（本地技能清单/调用计数）。不阻塞。
- 三条 API 路由（runtime/scan/skill/[name]）全部挂守卫，grep 证实 main 既有 scan/skill API 同批加固。

### 2. 验收记录绑定（evidence.ts/validate.ts）
12 项反例：版本变化 documentSha256→stale；exitCode=1→failed；timedOut→failed；缺 validator 字段/documentSha256 非 64hex→整份无效不当作通过；回执 callId 指向不存在调用→unverified；finishedAt<startedAt→无效；startedAt 早于 call.at→无效；新旧两份取最新（旧 pass 新 fail）→failed；技能 mtime 晚于调用→不绑定不显示通过。**全部按声明 fail-closed**。
- **F3 (P3 观察)**: 回执 JSON 无签名，本机攻击者理论上可手写 passed 回执；但须知道真实 sessionId/callId、时间窗约束（start≥call.at、finishedAt≤now）、documentSha256 绑定当前版本，伪造门槛实际存在；本机文件写权限已在威胁模型外。不阻塞。
- validate.ts 命令执行器：grep 证实仅 `scripts/verify-skill.ts`（CLI）导入，app/components 零导入——"Web API never imports this command runner" 声明成立。spawn 无 shell、进程组 SIGKILL、8MiB 输出上限、执行前后双重 digest+mtime 复核。

### 3. 去重与归属（logs.ts/evidence.ts）
同 `host:sessionId:callId` 重复记录取保守 outcome（error 优先）；同名双候选不挂 calls、双方 ambiguousCalls++（"归属不确定保留未定"成立）；跨 host 同名不歧义。

### 4. 正例同时验证（防只会拒绝）
合法 Host 全形态放行（单元+HTTP 200）；完整回执→passed；isValidationReceipt 接受合法结构；**端到端真实数据**：`/api/runtime?days=7` 在本机返回 1086 行、293 日志文件、15 roots、coverage complete=true、called:27/loaded:21（真实 CC 日志解析器工作）、validated:0 全 unverified（无回执不虚报通过，符合设计）；断链 symlink (~/.codex/skills/laohan-edu-guard) 如实进 issues 不崩溃。`npm test` 26/26 独立复跑通过。

### 5. 与 main 兼容
lib/scanner.ts 主体未改；scan/skill API 仅加 isLocalRequest 守卫；UI 为渐进增强（既有体检数据流保留，新增 RuntimePanel + AbortController + 错误处理），无破坏性改动。

## 未测项及原因
1. 生产构建 `npm run build`——收尾窗口 2026-11-17 已本地复验 exit 0（任务包已验事实，引用）；复审在 dev 模式完成 HTTP 层验证，重跑 build 超时间预算。
2. codex app-server 探测的 state 细节——端到端 200 响应含 codex 字段，未单独核其 state 值（codex CLI 在线状态波动，非本 PR 逻辑缺陷面）。
3. 真实浏览器 evil 页面跨站 fetch——sec-fetch-site/Origin 已在 curl 层等价验证，浏览器层重复构造成本高。
4. 8MiB 日志行跳过/预算中断路径——纸面审查 fail-closed（issue 记录+零记录≠未使用文案），未构造超大日志实测。
