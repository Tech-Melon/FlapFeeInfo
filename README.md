# 技术瓜FlapFeeInfo

## 图标说明

插件按税收分配比例展示（有值才出）：

- 💎`N%`：持有人分红
- 👨‍🍳`N%`：创作者/营销收税
- 🎁`N%`：vault gift
- 🔥`N%`：销毁
- 💧`N%`：回流流动性
- ❓️未：未知 / 链上查不到有效分配

多项非零时显示完整串，例如：`💎90% 👨‍🍳10%`。悬停可看买卖税率。

若卡片上已有底池/报价信息（BNB、USDT、NVDAB 等），徽章会合成：

- 🪙`QUOTE` | `fee`，例如 `🪙BNB | 💎90%`、`🪙USD1 | 💎100%`、`🪙NVDAB | 💎100%`
- 不隐藏原网站的底池小图标；读不到报价时仍只显示 fee

支持尾号 `8888`（fee）与 `7777`（tax）代币。

这是一个浏览器插件，用来在 GMGN、Debot、Gungnir 页面上，自动给符合条件的 token 卡片显示税收分配与底池报价信息。

## 下载安装

### 方式一：直接下载仓库代码

1. 打开这个仓库主页。
2. 点击右上角绿色的 `Code` 按钮。
3. 选择 `Download ZIP`。
4. 下载完成后，把 ZIP 解压到电脑任意文件夹，比如：
   `D:\FlapFeeInfo`

### 方式二：使用 Git 克隆

如果你的电脑已经安装了 Git，也可以执行：

```powershell
git clone https://github.com/Tech-Melon/FlapFeeInfo.git
```

克隆完成后，仓库目录就是插件文件。

## 安装到浏览器

### Chrome / Edge / Chromium

1. 打开浏览器。
2. 在地址栏输入：
   `chrome://extensions/`
3. 打开右上角的 `开发者模式`。
4. 点击左上角的 `加载已解压的扩展程序`。
5. 选择你刚才解压出来的这个文件夹里的 `extension` 目录。
   例如：
   `D:\FlapFeeInfo\extension`
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

### 3. 有 fee 但没有 🪙BNB / 🪙USD1

- 请使用 **0.2.9+**（GMGN 默认 BNB 池、USD1 特殊图标）  
- Debot 侧依赖站点的「流动池」标签；站点未渲染时插件也读不到  

### 4. 右上角没看到插件图标

去浏览器扩展菜单里，把它固定到工具栏。

### 5. Windows 提示权限或路径错误

建议把仓库放到一个简单路径，例如：
`D:\FlapFeeInfo`

不要放在带空格、中文特殊符号太多的深层目录里。

## 注意

这个仓库对外只需要 `extension` 目录（及 README 等说明）。
后端服务不需要用户自己部署。
