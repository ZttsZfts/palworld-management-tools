# 参与贡献

感谢你愿意改进 Palworld Server Studio。提交代码前，请先搜索已有 Issue，确认问题或需求尚未被处理。

## 本地开发

1. 安装当前 Node.js LTS 版本。
2. 运行 `npm install` 安装依赖。
3. 运行 `npm run dev` 启动开发环境。
4. 提交前运行 `npm test`。

项目只使用 Electron、Node.js、纯 JavaScript、EJS、jQuery、Bootstrap 5、Bootstrap Icons 和 CSS3。引入新的运行时依赖前，请先在 Issue 中说明用途、体积和维护成本。

## 提交规范

- 一个提交只处理一类问题，提交信息应清楚说明改动目的。
- 注释、界面文字和项目文档使用自然、准确的中文。
- 不要提交服务器密码、玩家真实数据、存档、缓存、日志或构建产物。
- 修复缺陷时请补充可复现步骤；可以自动验证的逻辑应同时补充测试。

## Pull Request

PR 说明应包括改动内容、验证方式、兼容性影响和相关 Issue。涉及界面调整时，请附上修改前后的截图。
