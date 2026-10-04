# iPhone 专属高强度跳绳间隔计时器 (Interval Timer PWA)

专为 iPhone 与运动爱好者打造的独立全屏 Web App (PWA)。支持后台音乐混音不抢占、高饱和度远距离全屏变色、屏幕常亮、零依赖离线秒开以及全参数方案自定义。

---

## 核心特性

- 🎵 **背景音乐零干扰 (Zero Music Interruption)**：采用纯 Web Audio API 瞬态合成环境音效，绝对不抢占系统媒体焦点，Apple Music / Spotify 音乐持续畅享不打断。
- 🏃 **默认内置 25.5 分钟跳绳强化方案**：
  - **准备时间**: 10 秒
  - **跳绳做功**: 45 秒
  - **组间休息**: 15 秒
  - **单轮组数**: 8 组
  - **大轮休息**: 45 秒
  - **总大轮数**: 3 轮
  - **总耗时**: 25.5 分钟（纯跳绳做功累计整 18 分钟，总计 24 组）。
- 🎨 **超强远距离视觉辨识**：大面积高饱和度全屏主题色随阶段动态切换（准备橙、做功绿、休息红、大轮歇蓝、完成紫），3~5 米外晃动视线仍清晰可见。
- 📱 **原生级沉浸体验**：适配 iPhone 灵动岛/刘海与底部安全区（`viewport-fit=cover`），支持 Safari「添加到主屏幕」全屏独立运行。
- 💡 **屏幕常亮 (Screen Wake Lock)**：训练开始自动保持屏幕常亮，防止锁屏中断节奏。
- ⚡ **离线秒开 (Offline PWA)**：内置 Service Worker 自动缓存所有资源，断网也能秒开秒练。
- ⚙️ **灵活方案管理**：支持自定义任意时长、自由微调、一键新建、保存与删除多套训练预设，数据持久化于本地。

---

## iPhone 局域网 1 秒体验指引

1. **在电脑端启动本地服务**：
   ```bash
   # 在项目根目录下运行（无需任何 Node/npm 构建）
   python -m http.server 8080
   ```
2. **获取电脑局域网 IP**：
   - Windows: 在命令行输入 `ipconfig`，查看 `IPv4 地址`（例如 `192.168.1.100`）。
3. **在 iPhone Safari 中打开**：
   - 确保 iPhone 与电脑连接同一 Wi-Fi。
   - 打开 Safari 访问 `http://192.168.1.100:8080` 即可开始训练！

---

## 安装为独立 iPhone App（添加到主屏幕）

为了获得无浏览器地址栏、全屏沉浸的原生 App 体验：

1. 在 iPhone **Safari** 浏览器中打开本项目网页。
2. 点击 Safari 底部中央的 **分享按钮**（向上箭头的方框图标）。
3. 在弹出菜单中向下滑动，选择 **「添加到主屏幕」 (Add to Home Screen)**。
4. 确认应用名称为 **「跳绳计时」**，点击右上角 **「添加」**。
5. 返回 iPhone 主屏幕，点击生成的跳绳计时图标即可进入独立全屏 App！

---

## 云端一键永久免费上线指南

本项目为纯前端零依赖静态架构，可直接免费托管于任何静态平台：

### 选项 A: GitHub Pages（推荐）
1. 将本项目代码推送到您的 GitHub 仓库。
2. 进入仓库 **Settings** -> **Pages**。
3. 在 **Build and deployment** 下的 **Branch** 选择 `main` 或 `master`，目录选择 `/ (root)`。
4. 点击 **Save**，数秒后即可获得公网 HTTPS 网址。

### 选项 B: Cloudflare Pages / Vercel / Netlify
1. 登录 Cloudflare / Vercel 并连接您的 GitHub 仓库。
2. Build command 留空，Output directory 设为根目录 `/`。
3. 点击 Deploy，即刻生成全球高速 CDN 访问链接。

---

## 技术架构

- **核心语言**：HTML5 / Modern ES6 JavaScript / CSS3（原生零依赖）
- **测试框架**：Node.js 原生测试运行器 `node:test` (100% TDD 驱动)
- **体积指标**：全部静态资源 < 30KB，首屏加载 < 50ms。

---

## 运行自动化测试

在项目根目录下运行原生 Node 测试套件：

```bash
node --test test/presets.test.js test/timer.test.js test/audio.test.js test/wakelock.test.js
```
