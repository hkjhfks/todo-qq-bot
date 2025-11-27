## TODO QQ Bot

基于 QQ 官方机器人开放平台 + Hugging Face dataset 的 TODO 提醒机器人，仅支持沙箱环境、自用。

另外可选集成企业微信**群机器人**，每日定时主动推送 TODO 提醒，并提供一个简单的 Web UI 实时查看日志。

### 项目总览

- QQ 机器人：接收 QQ 官方平台的 Webhook 消息，根据指令查询 TODO 并回复。
- 数据源：从 Hugging Face dataset 拉取 `todos.json`，按北京时间处理截止日期。
- 企业微信群机器人（可选）：每天北京时间 10:00 主动把 `/check` 结果推送到指定企业微信群。
- Web UI（日志）：内置 `/webui` 页面，通过 SSE 流实时展示当前容器内 Node 进程的日志（类似 `docker logs -f`）。

### 目录结构

- `src/hfClient.js`：从 Hugging Face dataset 读取 `todos.json`。
- `src/dateUtils.js`：统一按北京时间 (UTC+8) 处理日期。
- `src/todoQueries.js`：封装四种查询逻辑：
  - `/today`：今天截止的未完成任务
  - `/3d`：今天+未来两天截止的未完成任务
  - `/all`：所有有截止日期的未完成任务
  - `/check`：等价于原先“每日 10 点提醒”的逻辑：返回未来三天任务汇总，如果有今天截止的任务，再追加三条“今天截止的重要提醒”。
- `src/bot.js`：QQ 官方机器人入口，处理消息并回复，同时启动企业微信定时任务和 Web UI HTTP 服务。
- `src/weworkNotifier.js`：企业微信群机器人通知模块，复用 `/check` 的逻辑，每天定时推送到群里。
- `src/logger.js`：简单的日志聚合与订阅模块，用于给 Web UI 推送日志。

### 环境变量

与 TODO Web 项目共用 Hugging Face 配置：

- `HF_TOKEN`：有该 dataset 读权限的 Access Token。
- `HF_REPO_ID`：dataset 仓库 ID（例如 `your-name/todo-data`），不设置则尝试使用 `SPACE_ID`。
- `HF_REPO_TYPE`：固定为 `dataset`（默认）。
- `HF_REPO_FILE`：todos 文件路径，默认 `data/todos.json`。

QQ 机器人相关：

- `QQ_BOT_APP_ID`：QQ 官方机器人应用的 `appId`。
- `QQ_BOT_SECRET`：机器人密钥。
- `QQ_ADMIN_OPENID`（可选）：仅响应该 openid 发来的指令；不设置则对所有用户指令生效。

企业微信群机器人相关（可选）：

- `WEWORK_WEBHOOK_URL`：企业微信「群机器人」的 webhook 完整地址，形如 `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxx`。
  - 配置后，服务会在**每天北京时间 10:00** 自动执行一次等价于 QQ `/check` 指令的逻辑：
    - 第 1 条消息：未来三天（含今天）的未完成任务汇总。
    - 如果有今天截止的任务，再额外连发 3 条相同的“今天截止的重要提醒”。
- `WEWORK_TEST_PORT`（可选）：Web UI 和测试 HTTP 服务监听端口，默认 `7002`。

### 启动方式

#### 本地直接运行

```bash
cd /home/xiaohu/code/todo-qq-bot
npm install  # 已安装可跳过

cp .env.example .env  # 然后编辑 .env 填写真实值
npm start
```

#### 使用 Docker 运行

1. 在项目根目录准备 `.env`：

```bash
cd /home/xiaohu/code/todo-qq-bot
cp .env.example .env
vim .env  # 修改为你的真实配置
```

2. 构建镜像：

```bash
docker build -t todo-qq-bot .
```

3. 直接使用 Docker Compose 运行：

```bash
docker compose up -d
```

或使用传统命令：

```bash
docker run -d \
  --name todo-qq-bot \
  --env-file .env \
  --restart unless-stopped \
  todo-qq-bot
```

容器会读取 `.env` 中的配置，启动 QQ Bot 并连接到 QQ 官方机器人沙箱环境。

如需从宿主机访问 Web UI（或测试接口），在 `docker-compose.yml` 中增加端口映射，例如：

```yaml
services:
  todo-qq-bot:
    ports:
      - "7001:7001"   # QQ Webhook
      - "7002:7002"   # Web UI & 测试接口（可选）
```

然后重启：

```bash
docker compose up -d --build
```

### 可用指令

- `/today`：查询“今天截止”的未完成任务。
- `/3d`：查询“今天 + 明天 + 后天”截止的未完成任务。
- `/all`：查询所有有截止日期的未完成任务。
- `/whoami`：返回你当前账号的 `openid`，可用于填到 `QQ_ADMIN_OPENID`。
- `/check`：
  - 第 1 条消息：未来三天（含今天）的任务汇总，按日期分组。
  - 如果有今天截止的任务，再额外连发 3 条完全相同的“【重要提醒】今天截止任务”列表。

所有查询结果的任务行格式统一为：

```text
任务名称:任务简介:截止时间
```

备注为空时会变成：

```text
任务名称::截止时间
```

### HTTP 接口一览

- QQ Webhook（由 QQ 官方平台回调）：
  - `POST /qqbot/webhook`（端口：`7001`）
  - 由 `qq-official-bot` SDK 管理签名校验和事件分发，业务逻辑在 `src/bot.js`。

- 企业微信测试接口（手动触发一次 `/check` 推送，用于验证群机器人）：
  - `GET /wework/test`（端口：`WEWORK_TEST_PORT`，默认 `7002`）
  - 触发逻辑与每天 10:00 的定时任务完全一致：发送三日汇总，若有今日任务再连发三条提醒。

- Web UI（日 志）：
  - 页面：`GET /webui`
    - 打开后会先加载最近一段历史日志，再通过 SSE 实时追加新日志。
  - 日志流：`GET /webui/logstream`
    - `Content-Type: text/event-stream`，前端使用 EventSource 订阅；
    - 内部来源是 `src/logger.js` 对 `console.log/info/warn/error` 的封装与缓冲。
