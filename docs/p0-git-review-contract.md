# P0 Git 审查功能 — Host/Client 契约（冻结规格 v1）

两个实现代理共用本契约。Host 代理改 `src/protocol.ts` + `src/index.ts` + 测试；Client 代理改 `src/client/*`（GitPanel.tsx、diffParser.ts、api.ts、styles.ts、locales.ts、locale/*.json）。集成时 `pnpm build` 的 tsc 会校验两侧对齐——类型名必须逐字一致。

## 新增协议类型（src/protocol.ts）

```ts
export interface WorktreeCommitRow {
  readonly hash: string        // full sha
  readonly shortHash: string
  readonly author: string
  readonly email: string
  readonly date: string        // ISO 8601 (git %aI)
  readonly subject: string
  readonly body?: string
}

export interface WorktreeLogValue {
  readonly path: string
  readonly commits: readonly WorktreeCommitRow[]
  readonly truncated?: boolean
}

export interface WorktreeCommitDetailValue {
  readonly path: string
  readonly hash: string
  readonly branch: string
  readonly changes: readonly WorktreeChangeRow[]  // name-status 映射，staged: true
  readonly diff: string                            // git show 的 unified diff
  readonly truncated?: boolean
}

export interface WorktreeCompareValue {
  readonly path: string
  readonly branch: string
  readonly ref: string
  readonly commits: readonly WorktreeCommitRow[]  // ref..HEAD（本分支多出的提交）
  readonly changes: readonly WorktreeChangeRow[]
  readonly diff: string                            // git diff --no-color ref...HEAD
  readonly truncated?: boolean
}

export interface WorktreeBlameCommit {
  readonly hash: string; readonly author: string; readonly date: string; readonly subject: string
}
export interface WorktreeBlameLine {
  readonly commit: number    // index into commits
  readonly oldNo: number; readonly newNo: number
  readonly code: string
}
export interface WorktreeBlameValue {
  readonly path: string; readonly file: string
  readonly commits: readonly WorktreeBlameCommit[]
  readonly lines: readonly WorktreeBlameLine[]
  readonly truncated?: boolean
}

export interface WorktreeHunkPatch { readonly file: string; readonly patch: string }

export interface WorktreeApplyPatchValue { readonly path: string }
```

## 新增错误码

`WORKTREE_LOG_FAILED` / `WORKTREE_APPLY_FAILED` / `WORKTREE_BLAME_FAILED`。showCommit/compare 失败复用 `WORKTREE_DIFF_FAILED`。

## 新增/扩展 RPC 动词（rWorktreeManager）

```ts
log(path: string, opts?: { refRange?: string; file?: string; limit?: number }, signal?): Promise<WorktreeLogValue>
// git log；默认 limit 200；refRange 如 'origin/main..HEAD'；file 模式加 '--follow -- <file>'

showCommit(path: string, hash: string, signal?): Promise<WorktreeCommitDetailValue>

compare(path: string, ref: string, signal?): Promise<WorktreeCompareValue>

blame(path: string, file: string, signal?): Promise<WorktreeBlameValue>
// git blame --porcelain（含内容行）；行数上限 5000，超出置 truncated

applyPatch(path: string, patch: string, opts?: { cached?: boolean; reverse?: boolean }, signal?): Promise<WorktreeApplyPatchValue>
// cached=true → git apply --cached（暂存 hunk）；reverse=true → 反向应用（丢弃工作区 hunk / unstage）
// patch 必须校验所有路径都解析到该 worktree 内部（防目录逃逸），非法 → WORKTREE_APPLY_FAILED
```

## 扩展现有动词（向后兼容）

```ts
commit(path, message, files, opts?: { hunks?: readonly WorktreeHunkPatch[] }, signal?): Promise<WorktreeCommitValue>
// hunks 非空时走临时索引流：复制当前 index（git rev-parse --git-path index）到临时文件，
// GIT_INDEX_FILE 指向副本 → git add -- <files> → 逐个 git apply --cached --whitespace=nowarn <hunk.patch>
// → git commit -m <msg>（仍在 GIT_INDEX_FILE 下）→ 删除临时文件；用户真实 index 不动
// untracked 文件的 hunk：先 git add -N 再 apply --cached；若实现受阻，允许对该文件退化为整文件 add，代码留注释

push(path, opts?: { forceWithLease?: boolean }, signal?): Promise<WorktreePushValue>
// forceWithLease=true → git push --force-with-lease；无 upstream 仍走现有 -u 流程
```

runArgv/gitRunner 需支持注入 env（GIT_INDEX_FILE）——host 代理检查现有 runner 并以最小改动扩展。

## Host 实现要点

- log 解析用 `%x1f` 分隔 + `%x1e` 记录终止，-z 风格安全解析作者/主题中的特殊字符
- showCommit changes 用 `git diff-tree --no-commit-id --name-status -r -M <hash>`，XY 状态映射复用 changesOf 的语义（staged: true）
- compare 复用 diffTextOf 的 NOISY_DIFF_PATHSPECS 与截断逻辑
- 新动词只加浏览器 RPC（本round不加 agent 工具）
- 测试：在 test/ 下新增或扩展（参考 worktree.test.mjs 现有风格），覆盖：log 解析、showCommit、compare、applyPatch cached/reverse、hunk 临时索引 commit（commit 后工作区剩余改动仍在、用户 index 未被污染）、push forceWithLease 参数成形。全部 `pnpm test` 必须绿（含既有 561 行 worktree.test.mjs + diffInline.test.mjs）

## Client 实现要点

- api.ts 增加上述方法；GitPanel 右栏改三 tab：变更 / 日志 / 比较；push 改确认浮层
- diffParser.ts：ParsedFileDiff 增加 `headerLines`（首个 @@ 之前的全部行）与 hunk 行区间；新增纯函数 `assemblePatch(parsed, file, hunkRowIdx: number[]): string` —— header + 选中 hunk 块（含各自上下文行）。hunk 粒度即可，行级选择不做（代码留注释），untracked 文件 hunk 暂存退化为整文件
- 变更 tab：hunk 横幅加勾选框（勾选 = 该 hunk 进本次 commit）；文件头加 [历史] [Blame] 按钮；hunk 横幅加 [暂存]（applyPatch cached）[丢弃]（applyPatch reverse 非cached，需确认）按钮，操作后刷新 diff；文件勾选与 hunk 勾选并存时文件优先（UI 提示）
- commit 调用：整文件勾选走 files，hunk 勾选走 opts.hunks
- 日志 tab：提交列表（默认全部，limit 200，客户端过滤 subject/author/hash）+ 区间预设（全部 / 未推送 upstream..HEAD，无 upstream 时禁用后者）；点提交 → showCommit 详情复用现有 diff 渲染器
- 历史：变更 tab 文件头 [历史] → 该文件 log(file) 列表 → 点提交看详情（同上）
- 比较 tab：ref 选择器（api.branches() 本地分支，排除当前）→ compare(ref)：提交列表 + diff 渲染
- push 浮层：列出 log(upstream..HEAD) 提交 + force-with-lease 勾选框 + 确认；无 upstream 走现有直接 push
- Blame：文件级视图（替代 diff 显示该文件）：每行左侧 gutter 列 shortHash/author/date/subject（title hover 全量），数据来自 blame()；返回按钮回 diff
- locales.ts + locale/zh.json + locale/en.json 同步补 key；样式沿用 owt-gp-* 体系（styles.ts）
- 客户端纯函数测试：assemblePatch 与日志过滤（test/ 下新文件，参考 diffInline.test.mjs 的 node:test 风格）

## 明确不做（本 round）
行级选块、amend、stash、cherry-pick、rebase、冲突三栏、agent 工具新增、side-by-side。