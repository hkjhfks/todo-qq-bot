require('dotenv').config();
const { OfficialBot, EventType } = require('qq-official-bot');
const {
  queryAllWithDeadline,
  queryTodayDue,
  query3DaysDue,
  queryCheckSummary,
} = require('./todoQueries');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function getConfig() {
  return {
    appId: getRequiredEnv('QQ_BOT_APP_ID'),
    token: getRequiredEnv('QQ_BOT_TOKEN'),
    secret: getRequiredEnv('QQ_BOT_SECRET'),
    // 可选：限制只响应某个管理员
    adminOpenId: process.env.QQ_ADMIN_OPENID || '',
  };
}

async function handleCommandText(content) {
  const text = (content || '').trim();
  if (!text.startsWith('/')) return null;

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
  const user = event.user || {};
  const openid = user.openid || user.id;
  return openid === adminOpenId;
}

async function startBot() {
  const config = getConfig();

  const bot = new OfficialBot({
    appId: config.appId,
    token: config.token,
    secret: config.secret,
    sandbox: true,
  });

  bot.on(EventType.READY, () => {
    console.log('QQ TODO Bot 已连接。');
  });

  bot.on(EventType.MESSAGE_CREATE, async (event) => {
    try {
      if (!isFromAdmin(event, config.adminOpenId)) {
        return;
      }

      const rawContent = event.content || '';
      const result = await handleCommandText(rawContent);
      if (!result) return;

      const messages = Array.isArray(result) ? result : [result];

      for (const msg of messages) {
        if (!msg) continue;
        await event.reply({
          content: msg,
        });
      }
    } catch (err) {
      console.error('处理消息失败', err);
      try {
        await event.reply({
          content: '处理指令时出错，请稍后再试。',
        });
      } catch (e) {
        // ignore
      }
    }
  });

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
