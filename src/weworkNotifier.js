const https = require('https');
const { URL } = require('url');
const { queryCheckSummary } = require('./todoQueries');

function getWebhookUrl() {
  const url = process.env.WEWORK_WEBHOOK_URL || '';
  return url.trim();
}

function postJson(urlString, payload) {
  return new Promise((resolve, reject) => {
    const webhookUrl = new URL(urlString);
    const body = JSON.stringify(payload);

    const options = {
      hostname: webhookUrl.hostname,
      port: webhookUrl.port || 443,
      path: webhookUrl.pathname + webhookUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          const err = new Error(
            `WeWork webhook 响应异常，状态码 ${res.statusCode}: ${data}`
          );
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

async function sendText(content) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.warn('WEWORK_WEBHOOK_URL 未配置，跳过企业微信通知。');
    return;
  }

  const payload = {
    msgtype: 'text',
    text: {
      content: String(content || ''),
    },
  };

  await postJson(webhookUrl, payload);
}

// 等价于 QQ Bot 的 /check：先发汇总，如果有今天截止任务，再连发三条“今天截止”提醒。
async function sendDailyCheckMessages() {
  const { summaryMessage, todayList, todayMessage } = await queryCheckSummary();

  // 汇总
  await sendText(summaryMessage);

  // 如果有今天截止的任务，额外连发三条
  if (Array.isArray(todayList) && todayList.length > 0) {
    const times = 3;
    for (let i = 0; i < times; i += 1) {
      await sendText(todayMessage);
    }
  }
}

module.exports = {
  sendDailyCheckMessages,
  sendText,
};
