<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 工程接续（D-198）

先完整读 `~/.agents/AGENTS.md`；接手先读 `STATUS.md` 全部当前任务区与匹配流水，再按上方 Next.js 注意事项执行。当前进度只写 STATUS.md，证据与历史按需进入 docs/handoff/，不写客户端 memory。

项目合同 TODO：维护 owner 后续核实业务目标、完整验证/发布与验收回滚事实；原批仅接入状态，不虚构已交付能力。现有 package.json 提供 npm run lint / npm run build；业务改动才运行适用检查。原批按 Jeffrey 明确指令在 main 精确提交文档并 push GitHub，不代表产品发布。

## 集成策略（D-SOLO-DIRECT-20261107）

canonical 为 main，integration=direct；机器声明为 `.governance/project.json`。Jeffrey 已持续授权本人单人新旧项目统一 direct：任务分支开发、并行写入用独立 worktree；完成适用验证与独立对抗复核后，由负责人自动合入 main 并同步已授权远端，不新建 PR 或重复索要合并确认。原单次文档直提记录不再作为长期集成规则。当前未安装本地 governance hook，不把 JSON 存在当 hook 已启用；中央完成门按该声明验准确候选。既有 PR1、未审候选、WIP 和业务合同 TODO 保留，不自动合并、关闭或发布。决策与验证见 [回执](docs/handoff/SOLO-DIRECT-20261107/RECEIPT.md)。
