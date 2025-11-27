## TODO QQ Bot

基于 QQ 官方机器人开放平台 + Hugging Face dataset 的 TODO 提醒机器人，仅支持沙箱环境、自用。

另外可选集成企业微信**群机器人**，每日定时主动推送 TODO 提醒。

### 目录结构

- `src/hfClient.js`：从 Hugging Face dataset 读取 `todos.json`。
- `src/dateUtils.js`：统一按北京时间 (UTC+8) 处理日期。
- `src/todoQueries.js`：封装四种查询逻辑：
  - `/today`：今天截止的未完成任务
  - `/3d`：今天+未来两天截止的未完成任务
  - `/all`：所有有截止日期的未完成任务
  - `/check`：等价于原先“每日 10 点提醒”的逻辑：返回未来三天任务汇总，如果有今天截止的任务，再追加三条“今天截止的重要提醒”。
- `src/bot.js`：QQ 官方机器人入口，处理消息并回复。
- `src/weworkNotifier.js`：企业微信群机器人通知模块，复用 `/check` 的逻辑，每天定时推送到群里。

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
