# Palworld Server Studio

面向 Windows 的幻兽帕鲁专用服务器管理工具，支持官方 REST API、Game Data API、RCON 和本地存档缓存。

> 本项目是社区维护的非官方工具，与 Pocketpair 无隶属或背书关系。

## 技术栈

- Electron 与 Node.js
- 纯 JavaScript 和 jQuery
- EJS 模板
- Bootstrap 5、Bootstrap Icons 和 CSS3

## 开发运行

```bash
npm install
npm run dev
```

提交代码前运行：

```bash
npm test
```

## Windows 构建

```bash
npm run build
```

NSIS 安装包及免安装目录输出到 `release/windows`。项目不再生成或支持独立 HTML 版本。

## 数据与离线缓存

- 服务器连接保存为 Electron 用户数据目录中的 `connections.json`。
- 每台服务器的最后有效数据保存为 `server-cache/<连接ID>.json`。
- 在线时默认每 3 秒自动同步，可按服务器配置且最低 1 秒；离线时继续显示玩家、公会、帕鲁和物品缓存。
- 玩家每日等级增量以本机时间每天 0 点为新基线。
- 官方 REST 与扩展数据源已经分离。公会、帕鲁、物品和完整离线玩家通过服务器配置中的扩展 JSON 路径提供，格式见 `examples/server-data.example.json`；未提供的数据会明确显示数据源状态。
- 扩展数据路径也可直接填写 PalworldSaveTools 导出的 `Level.json`。程序会流式读取大型存档并在 Electron 用户数据目录生成紧凑缓存；仅当源文件大小或修改时间变化时才重建，避免每次同步重复解析数百 MB 数据。
- Game Data API 用于补充实时 HP、三轴坐标、朝向、跟随帕鲁、公会据点和据点帕鲁状态。它提供的是当前世界 Actor 快照，不能代替完整存档。

## 当前功能

- 服务器名称、版本、人数、运行时间、世界天数、FPS 与帧时间。
- 游戏内 RCON 广播及管理控制台。
- 玩家在线状态、身份、等级日增量、平台、网络、位置、公会、帕鲁和物品档案。
- 公会列表、等级、成员详情及玩家/公会双向跳转。
- 玩家、公会、帕鲁和物品列表的排序与筛选。
- 玩家坐标按玩家和日期独立保存7天；轨迹页默认加载24小时，并对疑似瞬移的起止点高亮。
- 轨迹页支持地图底图、滚轮缩放、拖动平移及玩家身份变更后的轨迹合并。

## 启用官方接口

在 `PalWorldSettings.ini` 中启用 REST API：

```ini
RESTAPIEnabled=True
RESTAPIPort=8212
AdminPassword="请设置独立的强密码"
```

如需读取 Game Data，在服务端启动参数中追加：

```text
-enable-gamedata-api
```

修改后需要完整重启服务端。REST API 和 RCON 不应直接暴露到公网，详细建议见 [SECURITY.md](SECURITY.md)。

## 模块结构

- `src/main/main.js`：仅负责初始化、IPC 注册与 Electron 生命周期管理。
- `src/main/modules`：配置持久化、REST、RCON、IPC、模板渲染与窗口业务模块。
- `src/preload`：隔离渲染进程并暴露最小 IPC 白名单。
- `src/renderer/templates`：EJS 应用模板与页面局部模板。
- `src/renderer/modules`：导航、状态、模态框、连接配置与远程管理业务。
- `src/renderer/assets`：CSS3 产品视觉样式。

所有提示、确认和配置表单均使用 Bootstrap Modal，不使用浏览器原生弹窗。

## 参与贡献

提交 Issue 或 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。不要上传真实存档、服务器密码、连接配置、缓存或未经脱敏的玩家数据。

## 许可证与素材

源代码以 [MIT License](LICENSE) 发布。地图等第三方素材不自动适用 MIT 许可，详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
