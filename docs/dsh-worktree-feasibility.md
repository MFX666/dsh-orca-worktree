# DSH 复刻 Orca Worktree 管理功能（80%）可行性与复杂度评估

> 调研方式：DeepWiki（https://deepwiki.com/deepseek-ai/deepseek-harness ）
> 评估基准：《Orca Worktree 管理功能模块调研报告》（[orca-worktree-management-research.md](./orca-worktree-management-research.md)）
> 调研时间：2026-11-07 ｜ DSH 版本基准：0.2.2-rc.1
>
> ⚠️ DeepWiki 为 AI 生成的仓库 wiki，结论在动手实现前应以 monorepo 实际源码复核。

---

## 1. 结论先行

**可行性：高。复杂度：中。**

DSH 并不是从零开始——它已经有一套"worktree-native session"骨架（创建、恢复、进入、
diff review、创建进度 UI、agent 工具），约等于 Orca 生命周期 Create → Work → Review
三段的核心。复刻 80% 的实质工作是补齐**"管理面"**：

1. worktree 的**列表/状态/删除**（WorktreeService 目前只有 `create`/`restore`）；
2. 跨 Session 的 **worktree 注册表**（持久化元数据）；
3. 一个**管理面板 UI**；
4. 给 agent 的 **list/status/remove 工具**。

预估工作量：**单人 3–4 周**（含测试与打磨，DSH 测试规范严格，约一半工时在测试）；
分两期交付可在一期结束即获得可用能力。

---

## 2. DSH 现有能力盘点（DeepWiki 调研结果）

### 2.1 已存在的 worktree 相关组件

| 组件 | 包 | 能力 |
| --- | --- | --- |
| `WorktreeService`（`ctx.worktrees`） | `packages/experimental/worktree` | `create(agent, {name, from}, signal, onPhase)`：建分支+checkout 并切换 session cwd；`restore(agent, {path, branch, baseCommit, repositoryRoot})`：恢复被外部删除的 worktree（分支没了则在 baseCommit 重建） |
| `create_worktree` 模型工具 | `packages/experimental/tool-worktree` | 包装 `WorktreeService.create`，创建后经 `workingDirectory.set` 进入新 worktree |
| Forge 家族 | `packages/experimental/forge*`、`client-ui-forge` | 见 2.2 |
| `WorkingDirectoryService`（`ctx.workingDirectory`） | core | session 级 cwd 的 get/ensure/set；`working-directory/change` 事件；已运行终端/工具调用不跟随切换 |

`WorktreeService` 的工程质量相当高（对标 Orca 的安全设计）：

- 沙箱约束下执行 git（`sandbox.confine` + 调用 session 的文件策略，不扩权）；
- 清除全部 `GIT_*` 选择器环境变量、`GIT_TERMINAL_PROMPT=0`、禁 hooks（`core.hooksPath=/dev/null`）与 fsmonitor；
- checkout 时按需禁用 clean/smudge/process filter（不改 git config）；
- 路径穿越校验（相对路径、无 `..`/`.`/`\`/`:`）、分支名 `check-ref-format`、分支/路径冲突拒绝；
- worktree 池目录 `.agents/worktrees`（自忽略 `.gitignore`）、名称生成内嵌 session id 前 8 位；
- 超时/grace/输出字节上限（`WORKTREE_TIMEOUT`）、取消传播、dispose 时等待 pending 操作；
- 失败保留产物、不自动回滚（与 Orca"保留可重试"策略一致）。

### 2.2 Forge 家族（DSH 已有的"半个 Orca Review 面板"）

`forge-bundle` = `client-ui-forge` + `forge` 注册表 + `forge-github` + `forge-session` + 自带 worktree 服务：

- **New Session 的 "New worktree" 选项**（`WorktreeToggle`）：session 创建前经 `ctx.worktrees` 建好分支+checkout（`plugin:client-ui-forge/worktree` 记录），首条消息 turn 开始前就绪；`WorktreeCreations` 类持有 turn 直到 ready，含失败重试/取消回退原目录。
- **`ForgePanelController`（`ctx.forgePanel`，Typert 远程服务）**：只读 git 检查（`rev-parse`/`symbolic-ref`/`remote -v`/`for-each-ref`/`merge-base`/`diff --numstat`）、**fork point 检测**（session worktree 优先用其 `baseCommit`，否则遍历 remote HEAD 取 merge-base）、diff 解析成 files/hunks、本地更改卡片（+行/−行/文件数）。
- **外部删除检测 + "Restore worktree"**：session 的 worktree 被外部删掉时面板可感知并恢复。
- **`forge-github`**：变更请求（CR）创建（给 agent 发消息驱动）、checks 加载、review/行评论提交、markReady。
- **`forge-session`**：session ↔ CR 绑定存储。
- **client UI**：右侧栏 tab（changes view）、header 按钮、创建进度卡（`WorktreeProgress`）、session 列表图标（`SessionRowForge`）、toasts。

### 2.3 可复用的平台机制

- **服务模型**：cordis `Service` + `static inject` + `Config` schema（schemastery/zod）+ `ctx.effect` 清理。
- **bundle 声明**：`package.json` 的 `dsh.bundle.patch` → `cordis.patch.yml` insert 行。
- **client 双入口**：`src/index.ts`（Node 半）+ `src/client.ts`（浏览器半，`ctx.slots.inject/register` 注册 UI）；`locale/*.json` i18n；host/client 经 Typert RPC（`dsh-host-apiproxy` + `dsh-client-connection`）。
- **模型工具**：`defineTool` + `ctx.tools.register`（JSON Schema 参数）；Inspect provider（`cordis_inspect_list/query`）可暴露只读状态查询。
- **Session API**：`SessionCommandController.create` 可指定 `workspaceId` 或 `cwd` —— "在指定 worktree 打开新 session" 开箱即用。

---

## 3. 功能映射矩阵：Orca 15 项 → DSH 现状

| # | Orca 功能 | DSH 现状 | 缺口大小 |
|---| --- | --- | --- |
| 1 | 域模型 + 两段式 ID `<repoId>::<path>` | 部分：session↔worktree 一对一绑定；无 repo 注册、无全局 worktreeId | 中 |
| 2 | 创建：后台预备 + 进度流 | ✅ 基本等价（WorktreeCreations + 进度卡 + onPhase）；缺创建前 prefetch 优化 | 小 |
| 3 | 列表/检测（含外部 worktree 纳管） | ❌ 无全局 list；forge 只感知"当前 session 的 worktree 被删" | 中 |
| 4 | 切换/进入 worktree | ✅ `workingDirectory.set` + `working_directory` 工具；已运行终端不跟随（DSH 语义下可接受） | 小 |
| 5 | Review：diff vs start-from | ✅ 大部分等价（baseCommit→fork point、diff 解析、changes view）；inline commit/push 靠 agent 工具完成（设计差异，非缺口） | 小 |
| 6 | 删除/归档（clean 断言、保留分支、force、确认流、prune） | ❌ **完全缺失**（无任何 remove 能力） | 中-大 |
| 7 | base ref 持久化（`git config branch.<name>.base`） | 部分：baseCommit 存在 session 记录里，跨 session/重启后不可查；无 git config 落盘 | 小 |
| 8 | 元数据持久化（displayName、未读、PR 关联） | 部分：forge-session 存 CR 绑定；无通用 WorktreeMeta store | 中 |
| 9 | UI：worktree 列表卡片/分组/排序/lineage | 部分：有 session 侧图标与 forge tab；无 worktree 管理面板 | 中 |
| 10 | Agent 可编程入口（CLI/RPC） | ✅ 模式齐备（工具+inspect provider），但只有 `create_worktree` 一个工具 | 小 |
| 11 | orca.yaml hooks（setup/archive） | ❌ 无对应物 | 中（可推迟） |
| 12 | 信任预设 / 防休眠 / 睡眠会话恢复 | ➖ DSH session 由宿主持久化，无 Orca PTY"睡眠"问题；信任预设有独立授权体系 | 放弃/不等价 |
| 13 | SSH/远程 worktree | ❌（DSH remotes 是另一条线） | 放弃（20% 之外） |
| 14 | 稀疏检出 worktree | ❌ | 放弃（20% 之外） |
| 15 | 虚拟化大列表 / 移动端 / 云中继 | ❌ | 放弃（20% 之外） |

**覆盖核算**：已有 ≈ 30%（#2/#4/#5/#10 部分）→ 一期补 #3/#6/#7/#10 补全 ≈ +30% →
二期补 #1/#8/#9 + 外部纳管 ≈ +20%。**合计 ≈ 80–85%**；
剩余 15–20% = #11–#15（hooks、远程、稀疏、防休眠、大列表/移动端）。

---

## 4. 实施方案（工作包分解）

> 原则：**扩展而非改造**。新建 `packages/experimental/worktree-manager`（host）+
> `packages/experimental/client-ui-worktree-manager`（client），依赖现有
> `dsh-experimental-worktree` 与 forge，不动核心包。升级冲突风险最小化。

### 一期：host 核心 + agent 工具（~1–1.5 周）

| 工作包 | 内容 | 复用 | 估时 |
| --- | --- | --- | --- |
| W1 `WorktreeService` 扩展 | `list(repoRoot)`：解析 `git worktree list --porcelain -z`（现有 restore 已在用），标注 managed/external；`status(path)`：branch/dirty/ahead-behind；`remove({path, force?})`：clean 断言（`--porcelain` status）→ 未合并分支保留（`branch -d` 失败即 preserve）→ 委托 `git worktree remove`（不设超时，独立排队）→ `worktree prune` 兜底；`isWithinPool` 边界校验（只允许删池内目录，对标 Orca `isWithinWorktree`） | 现有 `runCommand`/沙箱/`GIT_ENV` 模式 | 3–5 天 |
| W2 WorktreeRegistry | 跨 session 持久化：`{worktreePath, branch, baseCommit, repositoryRoot, sessionId?, displayName, createdAt}`；存储复用 DSH storage/atomic-write 包模式；启动时与 `git worktree list` 对账（孤儿清理 = Orca prune 对应物） | `dsh-atomic-write`、forge 的 plugin record 经验 | 2–4 天 |
| W3 base ref 落盘 | create 成功后 `git config --local --replace-all branch.<b>.base <baseCommit>`；写失败 unset stale 值；`status`/forge fork-point 优先读它 | forge 现有 fork-point 优先级链 | 1 天 |
| W4 模型工具 + Inspect | `worktree_list` / `worktree_status` / `worktree_remove`（删除默认需确认策略：非 danger-full-access 下限制在池内 + 走审批）；inspect provider 暴露只读清单 | `dsh-experimental-tool-worktree` 范本、`ctx.tools.register`、inspect registry | 1–2 天 |

### 二期：管理面板 + 体验（~1.5–2.5 周）

| 工作包 | 内容 | 复用 | 估时 |
| --- | --- | --- | --- |
| W5 WorktreeController（host 远程服务） | Typert 远程服务（对标 `ForgePanelController`）：面板状态流 = registry + git 状态 + 关联 session 行 + CR 状态；事件订阅（`working-directory/change`、git 轮询） | forge 面板范本 | 2–3 天 |
| W6 管理面板 UI | client 插件：侧栏面板；按 repo 分组的 worktree 卡片（分支、dirty、session 关联、CR 徽标）；创建对话框（复用 `WorktreeToggle`/`WorktreeProgress`）；删除确认流（clean 警告 → 保留分支提示 → force 分离控件 + "always force" 记忆）；外部 worktree "hidden cards" 纳管 | `client-ui-forge` 组件、slots 体系、locale i18n | 5–8 天 |
| W7 打开/切换体验 | 卡片上"在此 worktree 打开新 session"（`SessionCommandController.create({cwd})`）+ 当前 session 切换（`working_directory` 工具已有） | Session API | 1–2 天 |
| W8 元数据操作 | displayName 编辑、归档标记（`isArchived`）读写 registry | W2 | 1 天 |

### 三期（可选，不计入 80%）

hooks（仓库级 `orca.yaml` 等价物，setup/archive）、lineage（parent worktree）、防休眠、
SSH worktree、稀疏检出。

---

## 5. 复杂度与工时汇总

| 期 | 工作包 | 人日 |
| --- | --- | --- |
| 一期 | W1–W4 | 7–12 |
| 二期 | W5–W8 | 9–14 |
| **合计（80% 目标）** | | **16–26 人日 ≈ 单人 3–4 周（含测试/评审/i18n）** |

复杂度定性：

- **低**：W3（git config 写入）、W4（工具包装）、W7（session API 已就绪）、W8。
- **中**：W1（删除安全网逻辑多但模式现成）、W2（对账/孤儿清理的边界情况）、W5（状态流组装）。
- **高（唯一）**：W6 面板 UI——工作量主体 + DSH 的 client 插件规范（双入口、slots、locale、
  快照测试）有学习成本；但 `client-ui-forge` 是完整范本，可大量抄结构。

---

## 6. 风险与缓解

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| **experimental API 漂移** | forge/WorktreeService 处于 0.2.x rc，接口可能变 | 只依赖、不修改现有包；新包独立命名；跟随上游 release 节奏回归 |
| **沙箱与删除权限** | `worktree remove` 是删除类操作；非 danger-full-access 模式下沙箱可能拦截 | 删除限定在 `.agents/worktrees` 池内（路径校验前置）；产品层面将 force/外部删除设计为需批准操作（与 DSH 审批模式一致） |
| **DeepWiki 信息滞后** | 函数名/行为可能与 HEAD 有偏差 | 动手前在 monorepo 本地跑 `pnpm test` 相关 spec 核对（一期 W1 的 porcelain 解析逻辑可先写测试再实现） |
| **UI 规范成本** | client 插件规范多（双入口/slots/locale/测试） | 以 client-ui-forge 为模板克隆结构，先做最小卡片列表再迭代 |
| **与 forge 职责重叠** | 面板与 forge tab 都展示 git 状态 | 分工：forge 管"session 的 CR/diff"，新面板管"worktree 资产管理"（列表/删除/纳管），共享 registry |

---

## 7. 结论

1. **不需要"复刻"——是"补全"**。DSH 已有 Orca 方案中最有架构含量的部分
   （沙箱安全的创建/恢复、session 绑定、fork-point diff review、创建进度 UI、agent 工具入口），
   且工程质量与 Orca 的安全设计在同一水平（路径校验、超时、失败保留、filter 禁用等逐条对应）。
2. **80% = 已有 30% + 一期 30% + 二期 20%**。核心缺口收敛为三件事：
   **列表/删除（安全网）、跨 session 注册表、管理面板**。
3. **单人 3–4 周**可到 80–85%；若只做一期（host + 工具，无新 UI），**1–1.5 周**
   即可获得"agent 完全自管理 worktree"的最小闭环——这与 DSH 的 agent-first 定位契合度最高，
   建议作为第一个里程碑。

---

## 8. 参考

- DeepWiki: https://deepwiki.com/deepseek-ai/deepseek-harness
  - Experimental Packages（worktree/forge）: #7.5
  - Tool Registry & Execution Pipeline: #3.2
  - Agent Loop & Lifecycle: #3.1
- 本项目 Orca 调研：[orca-worktree-management-research.md](./orca-worktree-management-research.md)
- 上游仓库：https://github.com/deepseek-ai/deepseek-harness （`packages/experimental/worktree`、`packages/experimental/forge*`）
