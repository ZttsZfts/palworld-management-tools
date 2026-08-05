# 帕鲁本地素材说明

本目录中的帕鲁资料于 2026-08-05 从
[`RayChen200318/palworld-save-studio`](https://github.com/RayChen200318/palworld-save-studio)
的 `main` 分支整理，源项目以 GPL-3.0 发布，并声明支持 Palworld 1.0。

- `pal-catalog.json`：288 个正式图鉴条目，包含内部 ID、图鉴编号、简中名、英文名和本地头像路径。
- `pal-id-map.json`：696 个存档/运行时角色 ID 的直接查询表，覆盖正式帕鲁以及 Boss、任务等变体。
- `pal-metadata.js`：由 ID 查询表生成的沙箱安全浏览器数据文件，供渲染页面直接加载。
- `../images/pals/*.{png,webp}`：288 个正式图鉴条目的本地头像，文件名使用内部 ID；扩展名按文件真实格式保存。

列表页建议优先按存档中的 `CharacterID` 查询 `pal-id-map.json`。展示头像时使用记录中的
`icon`；如果 `icon` 为 `null`，应显示通用占位图标。`canonicalId` 表示该变体对应的正式物种 ID。

示例：

```js
const metadata = palIdMap[pal.characterId] || palIdMap[pal.id];
const displayName = pal.nickname || metadata?.nameZh || pal.characterId || '未知帕鲁';
const iconUrl = metadata?.icon;
```

Palworld 及其游戏素材的相关权利归 Pocketpair, Inc. 所有。本项目保存这些素材仅用于帕鲁服务器
管理界面的识别与展示；分发应用时应再次确认游戏素材的授权和平台政策。
