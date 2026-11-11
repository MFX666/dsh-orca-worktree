# dsh-worktree-plugin

Orca 风格 Git Worktree 与对话侧边栏插件（DeepSeek Harness bundle）：

1. **左栏树 1:1 还原（`sidebar.workspaces` `priority: -1`）**：
   - 顶层项目组：`📁 仓库名` + hover `⌄` 折叠、`•••` 菜单、`+` 新建工作树。
   - 工作树分支行：左侧状态绿点（运行中呼吸、待确认黄点、空闲常绿）+ 分支名 + 右侧黄色 `★` 星标置顶。
   - 子工作树谱系胶囊：`[ ⑂ N | ● 运行数 ● 就绪数 ⌄ ]`，点击折叠/展开 `18px` 步进缩进的子工作树；谱系 = 注册表 `parentPath`，缺失时按物理路径嵌套自动推导（树可以有子树），移除父树时物理子树同样阻断。
   - Worktree 下直接对话：点击分支自动进入/创建绑定在该 worktree 目录下的独立对话（Session），支持展开同一 worktree 下的多条历史对话或点 `+` 新建多对话；对话行不带绿点——运行中显示 loading 转圈、等待确认显示黄点、结束时与原生 DSH 样式一致（无标记）。
   - 非 Git 文件夹工作区与未分组会话自动兜底保留，不丢任何历史会话；支持工作区重命名与移除（含本地目录已丢失的悬空工作区标记与一键移除）。
   - **按分支归档与设置页恢复（`设置 → 已归档会话`）**：删除工作树时，自动调用 DSH 官方 `workspaceRegistry.archiveSession` 将该分支下的对话归档，并在设置页左侧导航挂载 `已归档会话`（按 `Git 仓库 → Git 分支 → 会话` 层级分组，支持搜索、单条/整分支取消归档与一键恢复打开，与原生归档状态 100% 互通）。
2. **Host 远程服务（`rWorktreeManager`）与持久化工作树池**：
   - 默认工作树池位于 `~/.dsh/dsh-orca-worktrees/<repo-key>/<branch>`（可通过 `DSH_WORKTREE_POOL` 覆盖），独立于插件 `lib/` 构建目录，`pnpm build` 不会误删已有检出。
   - `overview(includeDirty?)`、`archivedMeta()`、`branches(repositoryRoot, refresh?)`、`create(repositoryRoot, name?, from?, parentPath?)`、`ensureWorkspace(path, title?)`、`setPinned(path, pinned)`、`remove(path, force?, deleteRemote?)`、`status(path)`。
   - 全部浏览器接口与当前是否打开 Session 解耦（无 `agent` 查找参数），新建 worktree 自动同步注册到宿主 `workspaceRegistry` 并持久化 `branch.<name>.base` 与谱系元数据。
3. **Agent 工具**：
   - `worktree_list`、`worktree_create`、`worktree_enter`、`worktree_status`、`worktree_pin`、`worktree_remove`。

## 构建与自检

```bash
pnpm build
pnpm test
```
