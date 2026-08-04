# Palworld Server Studio

Windows 专用的现代化幻兽帕鲁服务器远程管理工具。采用 Electron、Node.js、纯 JavaScript、EJS、jQuery、Bootstrap 5、Bootstrap Icons 和 CSS3。

## 开发运行

```bash
npm install
npm run dev
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

## 当前功能

- 服务器名称、版本、人数、运行时间、世界天数、FPS 与帧时间。
- 游戏内 RCON 广播及管理控制台。
- 玩家在线状态、身份、等级日增量、平台、网络、位置、公会、帕鲁和物品档案。
- 公会列表、等级、成员详情及玩家/公会双向跳转。
- 玩家、公会、帕鲁和物品列表的排序与筛选。
- 玩家坐标按玩家和日期独立保存7天；轨迹页默认加载24小时，并对疑似瞬移的起止点高亮。

## 模块结构

- `src/main/main.js`：仅负责初始化、IPC 注册与 Electron 生命周期管理。
- `src/main/modules`：配置持久化、REST、RCON、IPC、模板渲染与窗口业务模块。
- `src/preload`：隔离渲染进程并暴露最小 IPC 白名单。
- `src/renderer/templates`：EJS 应用模板与页面局部模板。
- `src/renderer/modules`：导航、状态、模态框、连接配置与远程管理业务。
- `src/renderer/assets`：CSS3 产品视觉样式。

所有提示、确认和配置表单均使用 Bootstrap Modal，不使用浏览器原生弹窗。
