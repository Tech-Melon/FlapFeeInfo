# 技术瓜FlapFeeInfo

## 图标说明

插件按税收分配比例展示（有值才出）：

- 💎`N%`：持有人分红
- 👨‍🍳`N%`：创作者/营销收税
- 🎁`N%`：vault gift
- 🔥`N%`：销毁
- 💧`N%`：回流流动性
- ❓️未：未知 / 链上查不到有效分配

多项非零时显示完整串，例如：`💎90%→SPCXB👨‍🍳10%`。悬停可看买卖税率。

**最大份额段会始终标注 `→SYMBOL`**（分红/营销/金库/销毁/LP 中 bps 最高的那一项），即使与底池 quote 相同也不省略，便于一眼确认分发币种：

- 💎 对应 `dividendToken`（空则回退 quote / BNB）
- 👨‍🍳🎁💧 对应池子 `quoteToken`（空则 BNB）
- 🔥 对应税代币自身

若卡片上已有底池/报价信息（BNB、USDT、NVDAB 等），徽章会合成：

- 🪙`QUOTE` | `fee`，例如 `🪙BNB | 💎90%→BNB`、`🪙SPCXB | 💎90%→SPCXB👨‍🍳10%`、`🪙USD1 | 💎100%→USD1`
- 不隐藏原网站的底池小图标；读不到报价时仍只显示 fee

支持尾号 `8888`（fee）与 `7777`（tax）代币。

**点击浏览器工具栏的插件图标**，可：

- 切换徽章 **深色 / 浅色** 主题（**默认深色**，适配 GMGN/Debot 黑底；浅色为实心浅底，对比更强）
- 勾选显示项（底池 🪙、💎/👨‍🍳/🎁/🔥/💧、→分发币种、未知，**默认全部开启**）

改完后当前页会即时刷新，无需重载扩展。

这是一个浏览器插件，用来在 GMGN、Debot、Gungnir 页面上，自动给符合条件的 token 卡片显示税收分配与底池报价信息。

## 下载安装

**推荐普通用户用方式一（Release）**，体积小、只含插件，不用下整仓。

### 方式一：从 GitHub Release 下载（推荐）

1. 打开 Releases 页面：  
   [https://github.com/Tech-Melon/FlapFeeInfo/releases](https://github.com/Tech-Melon/FlapFeeInfo/releases)
2. 在最新版本下找到资源文件，例如：  
   `FlapFeeInfo-extension-v0.3.4.zip`（版本号以页面上最新为准）
3. 下载 ZIP，解压到任意文件夹，例如：  
   `D:\FlapFeeInfo-extension`
4. 解压后目录里应直接能看到 `manifest.json`（或再进一层同名文件夹）。  
   安装时选**含有 `manifest.json` 的那一层**。

若还没有 Release，请用下面「方式二 / 三」，或等维护者发布后再下。

### 方式二：直接下载仓库代码

1. 打开仓库主页：  
   [https://github.com/Tech-Melon/FlapFeeInfo](https://github.com/Tech-Melon/FlapFeeInfo)
2. 点击右上角绿色的 `Code` 按钮。
3. 选择 `Download ZIP`。
4. 下载完成后解压，例如：  
   `D:\FlapFeeInfo`
5. 安装时选择其中的 `extension` 目录（不是仓库根目录）。

### 方式三：使用 Git 克隆

若已安装 Git：

```powershell
git clone https://github.com/Tech-Melon/FlapFeeInfo.git
```

克隆完成后，安装时选择：

```text
FlapFeeInfo\extension
```

## 安装到浏览器

### Chrome / Edge / Chromium

1. 打开浏览器。
2. 在地址栏输入：
   `chrome://extensions/`
3. 打开右上角的 `开发者模式`。
4. 点击左上角的 `加载已解压的扩展程序`。
5. 按下载方式选择目录：
   - **Release zip**：选解压后**含有 `manifest.json` 的文件夹**
   - **仓库 / Git**：选 `...\FlapFeeInfo\extension`
6. 等待几秒，插件就会安装完成。

### 安装后确认

安装成功后，你会在浏览器右上角看到插件图标。
如果没有显示，可以点浏览器右上角的扩展按钮，把它固定到工具栏。

## 使用方法

1. 打开 GMGN：
   `https://gmgn.ai/?chain=bsc`
2. 或者打开 Debot / Gungnir（同一前端的不同域名）：
   `https://debot.ai/meme?chain=bsc`
   `https://gungnir.bot/meme?chain=bsc`
3. 插件会自动扫描页面里的 token 卡片（约每 500ms）。
4. 尾号 `8888` / `7777` 的 Flap 税币会显示徽章，例如：
   - `🪙BNB | 💎90%`
   - `🪙USD1 | 💎100%`
   - 无底池信息时仅显示 fee：`💎90%👨‍🍳10%`

## 插件工作方式

插件只做展示，不需要你手动配置接口。
- **税收分配**：请求 Cloudflare Worker → 后端查链  
- **底池报价符号**：直接读当前网页 DOM（不额外请求）

```text
浏览器插件
  ├─ fee:  Cloudflare Worker -> VPS API -> BSC RPC
  └─ quote: 页面上的底池/报价图标与 aria-label
```

## 重新安装 / 更新

如果仓库有新版本，你只要：

1. 下载最新代码，或下载 Release 里的 `FlapFeeInfo-extension-vX.Y.Z.zip` 并解压。
2. 打开 `chrome://extensions/`。
3. 点当前插件的 `重新加载`（或重新「加载已解压」指向 `extension/`）。
4. **硬刷新** GMGN / Debot 目标页（否则可能仍是旧 content script）。

当前插件版本见 `extension/manifest.json` 的 `version` 字段。

## 常见问题

### 1. 插件装不上

检查你选择的是 `extension` 文件夹，不是仓库根目录。

### 2. 页面没有徽章

- 等列表加载完或刷新页面  
- 确认 token 尾号是 `8888` 或 `7777`  
- 扩展已重新加载，且页面已硬刷新  
- Debot / Gungnir **从 meme 点进 token 详情**：请使用 **0.4.30+**（SPA 顶栏徽章 + 进/回列表不卡顿）  

### 2b. 已更新但仍像旧版

- 产品站 / Releases 请确认 zip 文件名版本号 ≥ 你要的版本（例如 `FlapFeeInfo-extension-v0.4.30.zip`）  
- `chrome://extensions` 卡片上的版本号必须一致；改文件后要点 **重新加载**  
- Debot 页必须 **硬刷新**（Ctrl+F5），否则仍跑旧 content script  
- Debot 可能改写路径 `/token/bsc/0x…` → `/token/bsc/249218_0x…`；0.4.28+ 已归一化  
- **进 K 线 / 回列表卡顿**：0.4.29 收敛 force-scan；**0.4.30** 回列表 viewport-first 分片（首屏即时、屏外延后）  

### 3. 有 fee 但没有 🪙BNB / 🪙USD1

- 请使用 **0.2.9+**（GMGN 默认 BNB 池、USD1 特殊图标）  
- Debot 侧依赖站点的「流动池」标签；站点未渲染时插件也读不到  

### 3b. 没有 `→SYMBOL`（如 💎90%→BNB）

- 请使用 **0.3.0+**，并重新加载扩展 + 刷新页面  
- 后端/Worker 需已部署带 `top_payout_symbol` 的版本；旧缓存会自动 miss 重查

### 4. 右上角没看到插件图标

去浏览器扩展菜单里，把它固定到工具栏。

### 5. Windows 提示权限或路径错误

建议把仓库放到一个简单路径，例如：
`D:\FlapFeeInfo`

不要放在带空格、中文特殊符号太多的深层目录里。

## 注意

这个仓库对外只需要 `extension` 目录（及 README 等说明）。
后端服务不需要用户自己部署。
