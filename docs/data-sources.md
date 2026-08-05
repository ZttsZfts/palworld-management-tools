# 数据源说明

## 官方 REST API

程序使用 Palworld 官方 `/v1/api` 接口获取实时数据：

- `/info`：服务器名称、版本和描述。
- `/metrics`：在线人数、最大人数、运行时间、世界天数、FPS 和帧时间。
- `/players`：在线玩家名称、平台账户名、玩家 ID、用户 ID、IP、Ping、坐标、等级和建筑数量。
- `/game-data`：当前世界 Actor 快照，包括玩家、跟随帕鲁、据点帕鲁、野生帕鲁、NPC 和 PalBox。需要在服务端启动参数中添加 `-enable-gamedata-api`。
- `/announce`：游戏内广播。
- `/save`：保存世界。

`/game-data` 能补充实时公会、角色状态和据点数据，但不等于完整玩家存档，也不提供完整背包和全部离线玩家。

## 扩展 JSON 数据源

高级数据由可替换的 `SupplementalDataModule` 读取。服务器连接中的“扩展数据 JSON 路径”可以是本地路径，也可以是 Windows 网络共享路径。

参考文件：[server-data.example.json](../examples/server-data.example.json)。玩家通过 `playerId` 与官方 REST 玩家合并。数据源不可用时不会覆盖已有缓存。

扩展 JSON 可以由独立存档解析器、服务器端代理或定时任务生成。也可以直接配置 PalworldSaveTools 导出的 `Level.json`；程序会流式提取需要的数据，并在 Electron 用户数据目录维护紧凑缓存。
