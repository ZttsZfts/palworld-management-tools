# 幻兽帕鲁管理工具

一款面向 Windows 的《幻兽帕鲁》专用服务器桌面管理工具。项目基于 Electron，将官方 REST API、RCON、Game Data
与本地扩展数据整合到统一界面，方便服主管理服务器、玩家、公会和移动轨迹。

> 本项目由社区独立开发，与 Pocketpair, Inc. 不存在隶属、授权或背书关系。《幻兽帕鲁》、Palworld 及相关游戏素材的权利归其各自权利人所有。

## 功能介绍

### 服务器管理

- 保存和管理多台《幻兽帕鲁》服务器连接。
- 查看服务器版本、在线人数、运行时间、世界天数、FPS 和单帧耗时。
- 分别配置 REST、RCON、同步频率和扩展数据路径。
- 测试服务器连接，并保留最近一次有效快照供离线查看。

### 玩家与公会

- 查看玩家在线状态、等级、等级变化、平台、网络、坐标和最后在线时间。
- 按昵称、UID、Steam64、IP、公会和在线状态搜索或筛选玩家。
- 查看玩家的帕鲁、物品、所属公会及相关详细资料。
- 查看公会等级、成员、在线人数、据点和活跃帕鲁。

### 远程控制

- 通过 RCON 发送服务器管理指令。
- 发送游戏内广播。
- 快速执行服务器信息、玩家列表和保存世界等常用命令。

### 移动轨迹

- 按服务器、玩家和日期记录在线玩家坐标。
- 在世界地图上查看移动轨迹。
- 按时间范围和玩家筛选轨迹。
- 根据时间与位移距离标记疑似瞬移区段。

### 本地设置

- 支持亮色、暗色主题，并覆盖所有页面和模态框。
- 可在设置页面修改应用数据根目录。
- 明确展示连接配置、服务器快照、玩家轨迹、Level.json 解析缓存和界面渲染缓存的实际位置。
- 切换目录时不会静默移动或覆盖旧数据。

## 软件截图

### 服务器概览

> 图片占位：上传前请插入不包含服务器地址、群号、玩家标识或真实运营数据的脱敏截图。

### 玩家与公会

> 图片占位：玩家与公会页面截图（必须使用虚构数据）。

### 移动轨迹与控制台

> 图片占位：移动轨迹与 RCON 控制台截图（必须使用虚构数据）。


---

## 部署方式

### 方式一：安装 Windows 安装包

适合普通用户。

1. 从 [GitHub Releases](https://github.com/ZttsZfts/palworld-management-tools/releases) 下载最新的
   `幻兽帕鲁管理工具-Setup-版本号.exe`。
2. 运行安装程序。
3. 选择安装目录并完成安装。
4. 从桌面快捷方式或开始菜单启动软件。
5. 在“服务器”页面添加 REST 和 RCON 连接。

### 方式二：从源码运行

适合开发、调试或自行修改。

环境要求：

- Windows 10 或 Windows 11
- Node.js 20 或更高版本
- npm 10 或更高版本
- Git

获取并安装依赖：

```bash
git clone https://github.com/ZttsZfts/palworld-management-tools.git
cd palworld-management-tools
npm install
```

以开发模式启动：

```bash
npm run dev
```

普通启动：

```bash
npm start
```

项目使用 `package-lock.json` 固定 npm 依赖版本。请勿混用 pnpm 或提交其他包管理器的锁文件。

### 方式三：自行构建 Windows 安装包

完成依赖安装后执行：

```bash
npm run build
```

Electron Builder 会生成 NSIS 安装程序，默认输出目录为：

```text
release/windows/
```

生成的文件名格式为：

```text
幻兽帕鲁管理工具-Setup-<版本号>.exe
```

`release/` 属于构建产物，不应提交到 Git。

### 配置《幻兽帕鲁》服务器

在服务端 `PalWorldSettings.ini` 中启用官方 REST API：

```ini
RESTAPIEnabled=True
RESTAPIPort=8212
AdminPassword="请设置独立的强密码"
```

如果需要 Game Data API，在服务器启动参数中加入：

```text
-enable-gamedata-api
```

修改配置后需要完整重启游戏服务器。

软件内添加服务器时通常需要填写：

- 服务器名称
- 主机地址或内网 IP
- REST 端口，默认 `8212`
- RCON 端口，默认 `25575`
- 管理员用户名，默认 `admin`
- `AdminPassword` 对应的管理员密码
- 是否使用 HTTPS
- 自动同步频率

### 网络与安全建议

- 不要将 REST 或 RCON 端口直接暴露到公网。
- 优先使用可信局域网、VPN、防火墙白名单或安全的反向代理。
- 为管理接口使用独立强密码，不要与其他服务共用密码。
- 不要把真实存档、连接配置、缓存或未经脱敏的玩家数据提交到公开仓库。

### 更新部署

源码部署更新：

```bash
git pull
npm install
npm start
```

安装包部署更新时，可以直接安装新版本。应用数据默认保存在 Electron 用户数据目录，也可以在设置页面更改数据根目录。

切换数据根目录不会自动迁移旧文件。如需迁移，应先关闭软件，再手动复制旧目录中的配置与缓存文件。

## 数据来源与存储

- 官方 REST API：服务器信息、运行指标、在线玩家和远程操作。
- Game Data API：玩家坐标、生命值、跟随帕鲁、公会据点等实时 Actor 数据。
- 扩展 JSON：补充官方接口没有提供的玩家、公会、帕鲁和物品数据。
- `Level.json`：支持读取 PalworldSaveTools 等工具导出的 JSON 存档。

应用自身会写入以下内容：

```text
app-settings.json       启动主题和数据根目录配置
connections.json        服务器连接配置
server-cache/           最近一次有效服务器快照
movement-paths/         玩家移动轨迹
level-json-cache/       Level.json 解析缓存
renderer/               EJS 生成的界面缓存
```

除启动设置文件外，其余目录均由设置页面中的“数据根目录”统一控制。设置页面会显示每一项的实际绝对路径。

## 项目结构

```text
src/main/               Electron 主进程、接口客户端和数据仓库
src/preload/            渲染进程与主进程之间的受限 IPC 桥接
src/public/common/      应用外壳、公共模板、主题与共享逻辑
src/public/config/      帕鲁目录和编号映射等界面配置
src/public/image/       地图与帕鲁图像资源
src/public/page/        按页面组织的 EJS、JavaScript 和 CSS
src/shared/             主进程与渲染进程共享的常量
examples/               扩展数据格式示例
```

每个页面位于独立目录，并使用同名三件套：

```text
page/players/
├── players.ejs
├── players.js
└── players.css
```

## 参与贡献

欢迎提交 Issue 和 Pull Request。贡献前请确认：

1. 不包含真实服务器密码、私人信息、存档或本地缓存。
2. 修改范围清晰，并说明功能变化和验证方式。
3. 能够通过 `npm start` 启动应用，并检查相关页面和模态框。
4. 新增文件写入位置时，必须同步纳入设置页面的路径清单，不允许产生隐藏存储目录。

## 鸣谢

感谢以下项目、团队和社区：

- Pocketpair, Inc. 及《幻兽帕鲁》开发团队提供的游戏与官方服务器接口。
- Electron 和 Node.js 社区提供的桌面应用运行环境。
- Bootstrap、Bootstrap Icons、jQuery 和 EJS 等开源项目。
- [palworld-server-tool](https://github.com/zaigie/palworld-server-tool)：本项目的世界地图与玩家轨迹展示参考了该仓库的地图实现。
- [PalworldSaveTools](https://github.com/deafdudecomputers/PalworldSaveTools)：提供《幻兽帕鲁》存档文件从 SAV 转换为 JSON 的能力，为本项目读取扩展存档数据提供支持。
- [palworld-save-studio](https://github.com/RayChen200318/palworld-save-studio)：为本项目提供帕鲁头像素材参考与来源。
- 提交问题、建议、数据资料、测试反馈和代码贡献的社区成员。
- OpenAI Codex：协助本项目的程序设计、功能实现、代码整理和文档编写。

## 许可证

本项目源代码完全公开，允许个人、学习、研究、修改和再分发使用。完整条款见仓库根目录的 [`LICENSE`](LICENSE)。

商业使用同样免费，但在将本项目或其衍生版本用于商业产品、收费服务、商业交付或其他营利场景之前，必须通过 [GitHub Issues](https://github.com/ZttsZfts/palworld-management-tools/issues)
或作者公开联系方式通知作者。通知不代表需要支付授权费用，商业授权仍然免费。

使用和再分发时应满足以下要求：

1. 保留原项目的版权信息、许可证说明和来源说明。
2. 不得冒充原作者或暗示获得官方授权、合作或背书。
3. 商业使用前完成对作者的通知。
4. 对代码的修改、部署和运营风险由使用者自行承担。

本项目按“现状”提供，不承诺适销性、特定用途适用性或完全无错误。作者及贡献者不对使用本项目造成的数据损失、服务中断、安全问题或其他损害承担责任。

仓库中的游戏名称、地图、图片、图标、数据及其他第三方素材不自动适用上述源代码许可，其权利仍归各自权利人所有。来源和上游许可证见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)，使用或再分发这些素材前仍需自行确认相关法律和授权要求。
