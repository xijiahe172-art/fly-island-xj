# Fly Island XJ · Windows 灵动岛二次开发版

一个常驻屏幕顶部的 Windows 灵动岛：显示待办、计时、消息预览、媒体控制、剪贴板历史、DSH 会话等。

**本项目是 [flyl1u/fly-island](https://github.com/flyl1u/fly-island) 的二次开发版（非官方），基于 v0.2.20 修改。**
原项目采用 MIT 协议，原始版权归 flyl1u 及贡献者所有；本仓库同样以 MIT 发布，详见 [LICENSE](./LICENSE)。

## 与原项目的关系

| | |
|---|---|
| 来源 | 复刻自 flyl1u/fly-island v0.2.20（Tauri 2 + React 19 + Rust） |
| 保留 | 整体架构、待办/笔记/档案、消息监听、剪贴板、翻译、媒体控制、外观设置等原功能 |
| 改动 | 下面「本仓库新增/修改」一节，全部为本地二次开发 |
| 协议 | MIT，保留原作者版权声明 |

**不要把它当成原项目的官方版本**；遇到问题请先确认是本仓库改动导致，还是上游问题。

## 本仓库新增 / 修改

### 1. 折叠岛信息层

- 待办标题直接显示在折叠岛右侧，超过 22 字用 `...` 截断，宽度参与窗口宽度估算
- 有任务在计时时显示 `解决中 mm:ss`，字号字重与「剩余 N 个待办」一致
- 音频播放时，待办文字让位给波形（同一套 `data-audio` 状态 + `animation: none` 修复动画覆盖问题）

### 2. 待办

- **单槽位置顶**：置顶第二个任务时，第一个自动被顶下并落到第二个原来的位置；完成后自动取消置顶；载入时自动修正“已完成但仍置顶”的历史脏数据
- **计时**：开始/结束/完成结算到 `spentMs`；同一时刻只允许一个任务计时，开始新的会自动结算并停止旧的；旧数据里多个同时计时会在启动时收敛为一个
- **档案页每日汇总**：顶部显示 `天数 / 完成数 / 累计用时`，每张日期卡片显示 `完成 x/y · 用时 mm:ss`

### 3. 音频来源图标

- 折叠岛波形左侧显示来源图标：抖音（品牌音符）、网易云、QQ、微信，其余为 Windows 四色格
- 位置按「文字右缘」与「波形第一根柱子」实测取中点，支持拖动微调（±12px，Shift 精调 0.25x），可在设置里锁定
- 音乐页没有歌曲信息时，封面上显示来源图标，标题位显示来源名称（如「网易云音乐」）

### 4. 其他本地改动

- 应用名、配色、状态灯颜色等外观定制
- DSH 会话页（只读展示本地 DSH 会话回合）与状态桥
- 新增消息弹窗动画（收到微信/QQ 消息时方块弹出并可被下一条打断）

## 构建

要求：Windows、Node/pnpm、Rust（GNU 工具链）+ MinGW binutils。

```powershell
pnpm install
node node_modules\vite\bin\vite.js build
cd src-tauri
cargo build --release --features tauri/custom-protocol
```

> `--features tauri/custom-protocol` 必须带上，否则前端资源不会嵌入，启动后窗口空白。
> GNU 工具链构建产物需要 `WebView2Loader.dll`、`libgcc_s_seh-1.dll`、`libwinpthread-1.dll` 与 exe 同目录。

自编译的 exe 在启用「智能应用控制」的 Windows 上会被拦截，需要自行签名或关闭该功能。

## 许可

MIT，见 [LICENSE](./LICENSE)。
原始项目版权：Copyright (c) 2026 flyl1u and contributors。
本仓库二次开发部分的修改同样以 MIT 发布。
