# 数据源说明

## 官方 REST API

程序使用 Palworld 官方 `/v1/api` 接口获取实时数据：

- `/info`：服务器名称、版本和描述。
- `/metrics`：在线人数、最大人数、运行时间、世界天数、FPS 和帧时间。
- `/players`：在线玩家名称、平台账户名、玩家 ID、用户 ID、IP、Ping、坐标、等级和建筑数量。
- `/announce`：游戏内广播。
- `/save`：保存世界。

这些接口不提供公会、帕鲁、背包和完整离线玩家数据。

## 扩展 JSON 数据源

高级数据由可替换的 `SupplementalDataModule` 读取。服务器连接中的“扩展数据 JSON 路径”可以是本地路径，也可以是 Windows 网络共享路径。

参考文件：[server-data.example.json](../examples/server-data.example.json)。玩家通过 `playerId` 与官方 REST 玩家合并。数据源不可用时不会覆盖已有缓存。

扩展 JSON 可以由独立存档解析器、服务器端代理或定时任务生成。未来接入新的 `Level.sav` 解析器时，只需增加新的数据提供模块，不需要修改 UI 和官方 REST 模块。
