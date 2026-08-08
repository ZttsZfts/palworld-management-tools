# 幻兽帕鲁管理工具

`palworld-management-tools` 是一款面向 Windows 的非官方《幻兽帕鲁》专用服务器桌面管理工具。它将官方 REST API、Game Data API、RCON 与本地存档扩展数据整合到一个 Electron 客户端中，用于查看服务器状态、管理玩家与公会、发送远程命令并分析玩家移动轨迹。

> 本项目由社区维护，与 Pocketpair, Inc. 无隶属、授权或背书关系。Palworld、《幻兽帕鲁》及相关素材的权利归其各自权利人所有。

## 功能

- 查看服务器名称、版本、在线人数、运行时间、世界天数、FPS 与帧时间
- 保存多台服务器连接，并按服务器独立配置自动同步频率
- 查看玩家在线状态、身份、等级变化、平台、网络、坐标、公会、帕鲁与物品数据
- 查看公会成员、等级、据点及活跃帕鲁，并在玩家与公会详情间跳转
- 使用 RCON 发送管理命令与游戏内广播
- 按玩家和日期记录坐标，显示地图轨迹并标记疑似瞬移区段
- 缓存最近一次有效数据，在服务器离线时继续提供只读信息
- 读取扩展 JSON 或 PalworldSaveTools 导出的 `Level.json`，补充官方接口未提供的数据

## 技术栈

- Electron 与 Node.js
- JavaScript、jQuery 与 EJS
- Bootstrap 5、Bootstrap Icons 与 CSS

## 环境要求

- Windows 10/11
- Node.js 20 或更高版本
- npm 10 或更高版本
- 一台已启用所需管理接口的《幻兽帕鲁》专用服务器

## 安装与开发

```bash
git clone https://github.com/<your-account>/palworld-management-tools.git
cd palworld-management-tools
npm install
npm run dev
```

常用命令：

```bash
npm start       # 启动桌面应用
npm test        # 执行静态检查与测试
npm run build   # 检查后构建 Windows NSIS 安装包
```

构建产物生成在 `release/windows`，不应提交到版本库。

## 服务器配置

在 `PalWorldSettings.ini` 中启用官方 REST API：

```ini
RESTAPIEnabled=True
RESTAPIPort=8212
AdminPassword="请设置独立的强密码"
```

如需读取 Game Data，请在服务端启动参数中加入：

```text
-enable-gamedata-api
```

修改配置后需要完整重启服务端。请勿将 REST API 或 RCON 端口直接暴露到公网；建议仅通过可信局域网、VPN、防火墙白名单或反向代理访问，并为管理接口使用独立强密码。

## 数据来源与本地存储

- 官方 REST API 提供服务器信息、指标与在线玩家等实时数据。
- Game Data API 补充实时生命值、三轴坐标、朝向、跟随帕鲁、公会据点与据点帕鲁状态；它是当前世界 Actor 快照，不能代替完整存档。
- 扩展数据路径可指向自定义 JSON，示例结构见 `examples/server-data.example.json`；也可直接指向 PalworldSaveTools 导出的 `Level.json`。
- 连接配置保存在 Electron 用户数据目录的 `connections.json`。
- 最近一次有效快照保存在 `server-cache/<连接ID>.json`。
- 大型 `Level.json` 会被流式读取并转换为紧凑缓存，仅在源文件大小或修改时间变化时重建。
- 玩家轨迹按玩家和日期保存，默认保留 7 个自然日；每日等级基线按本地时间 00:00 更新。

连接配置可能包含服务器地址和管理员凭据。不要提交真实存档、密码、缓存、连接配置或未经脱敏的玩家数据。

## 项目结构

```text
src/main/                 Electron 主进程、接口客户端、缓存与数据仓库
src/preload/              受限的渲染进程 IPC 桥接
src/public/common/         应用外壳、公共模板、状态与共享界面逻辑
src/public/config/         帕鲁目录、编号映射等界面配置
src/public/image/          地图与帕鲁图像资源
src/public/page/           按页面组织的 EJS、JavaScript 与 CSS
scripts/                  项目检查、测试与素材处理脚本
examples/                 扩展数据格式示例
```

## 参与贡献

欢迎通过 Issue 报告可复现问题或提出功能建议，也欢迎提交 Pull Request。提交前请：

1. 确认没有包含服务器密码、个人信息、真实存档或大型构建产物。
2. 保持修改范围清晰，并说明行为变化和验证方法。
3. 运行 `npm test`，确保检查与测试通过。

## AI 使用声明

本项目部分代码由 AI Agent 编写或辅助生成，并经过项目维护者审阅、整合与测试。AI 生成内容不代表绝对正确；如发现安全、兼容性或数据处理问题，请提交 Issue。

## 许可与素材

除另有说明外，本项目源代码采用 MIT License：

```text
MIT License

Copyright (c) 2026 palworld-management-tools contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

仓库中的游戏名称、地图、图像、图标、数据或其他第三方素材不因上述许可而自动转为 MIT 许可，其权利仍归原权利人所有。使用、再分发或替换这些素材时，请自行确认适用条款。
