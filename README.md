# 技术瓜FlapFeeInfo

## 图标说明

插件按税收分配比例展示（有值才出）：

- 💎`N%`：持有人分红
- 👨‍🍳`N%`：创作者/营销收税
- 🎁`N%`：vault gift
- 🎓`N%`：Giggle 慈善（Four.meme）
- 💛`N%`：Binance 慈善（Four.meme）
- 🔥`N%`：销毁
- 💧`N%`：回流流动性
- ❓️未：未知 / 链上查不到有效分配

**100% 份额只显示类型图标**（不写 `100%`），例如 `💎`、`🎁→BNB`；非 100% 仍带百分比，如 `💎90%`。

多项非零时显示完整串，例如：`💎90%→SPCXB👨‍🍳10%`。悬停可看买卖税率。

**最大份额段会始终标注 `→SYMBOL`**（分红/营销/金库/销毁/LP 中 bps 最高的那一项），即使与底池 quote 相同也不省略，便于一眼确认分发币种：

- 💎 对应 `dividendToken`（空则回退 quote / BNB）
- 👨‍🍳🎁💧 对应池子 `quoteToken`（空则 BNB）
- 🔥 对应税代币自身

若卡片上已有底池/报价信息（BNB、USDT、NVDAB 等），徽章会合成：

- `{🦋|🖐️|🪙}QUOTE | fee`：Flap（7777/8888）用 🦋，Four.meme（ffff）用 🖐️，其它用 🪙  
  例如 `🦋BNB | 💎90%→BNB`、`🖐️USD1 | 💎100%→USD1`
- **币股 vault** 底池是 BNB，不会把 NVDAB / FXION 等分红股票当成底池；股票只出现在 📈 段
- 不隐藏原网站的底池小图标；读不到报价时仍只显示 fee

支持尾号 `8888` / `7777`（Flap）与 `ffff`（Four.meme）税币。

**点击浏览器工具栏的插件图标**，可：

- 切换徽章 **深色 / 浅色** 主题（**默认深色**，适配 GMGN/Debot 黑底；浅色为实心浅底，对比更强）
- 勾选显示项（底池、💎/👨‍🍳/🎁/🎓/💛/🔥/💧、→分发币种、未知，**默认全部开启**）
- **自定义尾号屏蔽**（仅 BSC）：添加多条 hex 尾号规则，隐藏 CA 以该尾号结尾的代币（战壕「新创建」列）

主题、资金接收屏蔽、尾号屏蔽、显示项、徽章位置在弹窗里**默认折叠**，点标题展开。

改完后当前页会即时刷新；尾号/资金接收方屏蔽变更可能触发列表页一次 reload。

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

当前插件版本见 `extension/manifest.json` 的 `version` 字段（**0.7.14**）。

### 0.7.x 要点（近期）

- **0.7.14**：新创建卡片直接进入轻量队列；累计 3 个 CA 或等待 500ms 批量请求，虚拟列表回收卡片自动取消，减少新卡徽章延迟与无效请求
- **0.7.9**：K 线左侧战壕下滑后徽章可靠补绘；滚动更顺  
- **0.7.7+**：钱包追踪 / 收藏面板不挂徽章  
- **0.7.4+**：错徽章（行 CA 与徽章不一致）加固；新创建在开启屏蔽时最长保留约 10 分钟 / 40 卡  
- 支持 Flap `7777`/`8888` 与 Four.meme `ffff`

## 常见问题

### 1. 插件装不上

检查你选择的是 `extension` 文件夹，不是仓库根目录。

### 2. 页面没有徽章

- 等列表加载完或刷新页面  
- 确认 token 尾号是 `8888` 或 `7777`  
- 扩展已重新加载，且页面已硬刷新  
- Debot / Gungnir **从 meme 点进 token 详情**：请使用 **0.4.36+**  
- GMGN **战壕↔K 线卡顿 / 回战壕徽章慢**：请使用 **0.4.37+**  
- GMGN **搜索/历史弹层徽章慢（约 5s）**：请使用 **0.4.38+**  
- GMGN **K 线→战壕徽章 ~3–6s 才齐**：请使用 **0.4.39+**（若卡顿请用 **0.4.40** 轻量路径）  
- GMGN **刷新/滚动/一切都卡**：请使用 **0.4.42**（mutation 非 force + href-only + roots≤3）  

### 2b. 已更新但仍像旧版

- 产品站 / Releases 请确认 zip 文件名版本号 ≥ 你要的版本（例如 `FlapFeeInfo-extension-v0.4.42.zip`）  
- `chrome://extensions` 卡片上的版本号必须一致；改文件后要点 **重新加载**  
- Debot / GMGN 页必须 **硬刷新**（Ctrl+F5），否则仍跑旧 content script  
- Debot 路径 `249218_0x…`：0.4.28+ 已归一化  
- **回战壕「已迁移」慢 / 左中有右无**：0.4.36 三栏轮询，不再左列吃满配额  
- **GMGN 回 home 右列**：同三栏轮询策略  
- **K 线顶栏不走卡片坐标**：0.4.34+  
- **GMGN / Debot / Gungnir K 线地址旁徽章偶发消失**：请使用 **0.5.10+**（React 地址行重绘后定向补挂）
- **Debot 三列战壕高数据量滚动卡顿**：请使用 **0.5.11+**（滚动冷却、Mutation 反馈环抑制、分片补扫）
- **战壕进入 K 线时徽章移动或切页卡顿**：请使用 **0.5.12+**（冻结离场战壕 DOM，真实地址行挂载后才绘制 K 线徽章）
- **K 线返回战壕时左侧残影 / 徽章提前错挂**：请使用 **0.5.13+**（等待真实战壕跨列 DOM 出现后再绘制；后台恢复取消全量重挂）
- **非 7777/8888 卡片错误残留徽章**：请使用 **0.5.14+**（虚拟列表复用卡片 DOM 时重新校验短地址、路由地址和 token 缓存）
- **K 线内切换其他代币卡顿 / 徽章请求失败告警**：请使用 **0.5.15+**（原站路由提交后才处理徽章；请求失败静默退避，不启动全页 header 扫描）
- **GMGN 回战壕徽章延迟 / 内嵌战壕后续卡片不更新 / 搜索弹层卡顿**：请使用 **0.5.18+**（`TokenItem` 变动采用可见卡片定向队列；过滤常驻隐藏 dialog 与顶部搜索框的弹层误判；搜索弹层仅做单次 cache-first 绘制并将徽章挂在短地址旁；非目标 token 同步清理旧徽章）
- **搜索结果徽章位置**：请使用 **0.5.19+**（GMGN 挂在 `V/Fees` 列后；Debot/Gungnir 挂在代币名称行末尾；定位失败时静默跳过）
- **GMGN「已开盘」下方目标卡片缺徽章**：请使用 **0.5.20+**（常规扫描按三列及视觉卡片 round-robin 去重，后续轮次用轻量游标继续补洞，不再由左/中列重复候选挤占右列）
- **GMGN 新创建徽章慢 / 几十秒才出**：请使用 **0.5.22+**（仅 GMGN：防抖/early miss + 顶区未画优先 flush 与 batch 排序；Debot 逻辑不变）
- **战壕→K 线 SPA**：0.4.35+ 激活链加固  
- **GMGN 进出 K 线减负 + 回战壕加速**：0.4.37（header-only token scan + list-return DOM watch + click-arm）  
- **搜索/历史弹层 ≤1s 级徽章**：0.4.38（dialog-first + cache 直绘 + 矮行 climb + 即时 batch）  
- **GMGN K→战壕黑屏 5–6s**：0.4.39（Tax 种子 + keep-alive；易卡）  
- **GMGN 流畅对齐 0.4.22**：0.4.42（列表 mutation 非 force 900ms 限流；href-only；禁止 body 扫）  





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
