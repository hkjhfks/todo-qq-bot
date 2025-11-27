require('dotenv').config();
const http = require('http');
const { Bot, Intends, ReceiverMode } = require('qq-official-bot');
const cron = require('node-cron');
const {
  queryAllWithDeadline,
  queryTodayDue,
  query3DaysDue,
  queryCheckSummary,
} = require('./todoQueries');
const { sendDailyCheckMessages } = require('./weworkNotifier');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function getConfig() {
  return {
    appid: getRequiredEnv('QQ_BOT_APP_ID'),
    secret: getRequiredEnv('QQ_BOT_SECRET'),
    // 可选：限制只响应某个管理员
    adminOpenId: process.env.QQ_ADMIN_OPENID || '',
  };
}

function extractUserOpenId(event) {
  if (!event) return '';
  // C2C / 频道私信 / 频道消息统一从 sender 上取 openid
  const sender = event.sender || {};
  return sender.user_openid || sender.member_openid || '';
}

async function handleCommandText(content, event) {
  const text = (content || '').trim();
  if (!text.startsWith('/')) return null;

  if (text === '/whoami') {
    const openid = extractUserOpenId(event);
    if (!openid) {
      return '无法获取你的 openid，请稍后再试。';
    }
    return [
      '你的 QQ openid 如下：',
      openid,
      '',
      '可以将它填入 QQ_ADMIN_OPENID 环境变量中，仅允许该账号使用指令。'
    ].join('\n');
  }

  if (text === '/all') {
    return await queryAllWithDeadline();
  }
  if (text === '/today') {
    return await queryTodayDue();
  }
  if (text === '/3d') {
    return await query3DaysDue();
  }
  if (text === '/check') {
    const { summaryMessage, todayList, todayMessage } = await queryCheckSummary();
    const messages = [summaryMessage];
    if (todayList.length > 0) {
      // 额外三条完全相同的“今天截止”提醒
      messages.push(todayMessage, todayMessage, todayMessage);
    }
    return messages;
  }

  return null;
}

function isFromAdmin(event, adminOpenId) {
  if (!adminOpenId) return true;
  const sender = event.sender || {};
  const openid = sender.user_openid || sender.member_openid;
  return openid === adminOpenId;
}

function setupWeWorkSchedule() {
  const webhookUrl = process.env.WEWORK_WEBHOOK_URL || '';
  if (!webhookUrl.trim()) {
    console.log('WEWORK_WEBHOOK_URL 未配置，不启用企业微信定时提醒。');
    return;
  }

  // 每天北京时间 10:00 触发
  cron.schedule(
    '0 10 * * *',
    async () => {
      console.log('[WeWork] 开始执行每日 /check 定时任务');
      try {
        await sendDailyCheckMessages();
        console.log('[WeWork] 每日 /check 定时任务完成');
      } catch (err) {
        console.error('[WeWork] 每日 /check 定时任务失败', err);
      }
    },
    {
      timezone: 'Asia/Shanghai',
    }
  );

  console.log('已启用企业微信定时提醒（每天 10:00 北京时间）。');
}

function startWeWorkTestServer() {
  const webhookUrl = process.env.WEWORK_WEBHOOK_URL || '';
  if (!webhookUrl.trim()) {
    console.log('WEWORK_WEBHOOK_URL 未配置，不启动企业微信测试 HTTP 接口。');
    return;
  }

  const port = parseInt(process.env.WEWORK_TEST_PORT || '7002', 10);

  const server = http.createServer(async (req, res) => {
    const urlPath = (req.url || '').split('?')[0];

    if (req.method === 'GET' && urlPath === '/wework/test') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      try {
        await sendDailyCheckMessages();
        res.statusCode = 200;
        res.end('OK: 已向企业微信群机器人发送 /check 测试消息。\n');
      } catch (err) {
        console.error('[WeWork] 测试接口触发失败', err);
        res.statusCode = 500;
        res.end('ERROR: 发送企业微信测试消息失败，请查看服务端日志。\n');
      }
      return;
    }

    res.statusCode = 404;
    res.end('Not Found\n');
  });

  server.listen(port, () => {
    console.log(
      `企业微信测试接口已启动: http://localhost:${port}/wework/test (GET)`
    );
  });

  server.on('error', (err) => {
    console.error('企业微信测试 HTTP 接口启动失败', err);
  });
}

async function startBot() {
  const config = getConfig();

  // 启动企业微信定时任务（如果配置了 webhook）
  setupWeWorkSchedule();

  // 启动一个简单的 HTTP 测试接口，方便手动触发企业微信推送
  startWeWorkTestServer();

  const bot = new Bot({
    appid: config.appid,
    secret: config.secret,
    sandbox: true,
    removeAt: true,
    logLevel: 'info',
    // 订阅：C2C 私聊、频道消息、频道私信
    intents: [
      'C2C_MESSAGE_CREATE',
      'DIRECT_MESSAGE',
      'GUILD_MESSAGES',
      'PUBLIC_GUILD_MESSAGES',
    ],
    // Webhook 模式：由 QQ 平台回调到本机 HTTP 服务
    mode: ReceiverMode.WEBHOOK,
    port: 7001,
    path: '/qqbot/webhook',
  });

  bot.on('system.ready', () => {
    console.log('QQ TODO Bot 已连接。');
  });

  // 统一处理：私聊(C2C)、频道文本、频道私信
  const handler = async (event) => {
    try {
      if (!isFromAdmin(event, config.adminOpenId)) {
        return;
      }

      const rawContent = event.raw_message || event.content || '';
      const result = await handleCommandText(rawContent, event);
      if (!result) return;

      const messages = Array.isArray(result) ? result : [result];

      for (const msg of messages) {
        if (!msg) continue;
        // qq-official-bot 的 reply 接口期望传入字符串或消息元素数组，
        // 这里直接传入纯文本字符串，由 SDK 负责构建消息。
        await event.reply(String(msg));
      }
    } catch (err) {
      console.error('处理消息失败', err);
      try {
        await event.reply('处理指令时出错，请稍后再试。');
      } catch (e) {
        // ignore
      }
    }
  };

  bot.on('message.private.friend', handler); // QQ 消息列表私聊
  bot.on('message.private.direct', handler); // 频道私信
  bot.on('message.guild', handler); // 频道文本消息

  await bot.start();
}

if (require.main === module) {
  startBot().catch((err) => {
    console.error('启动 QQ TODO Bot 失败', err);
    process.exit(1);
  });
}

module.exports = {
  startBot,
};
