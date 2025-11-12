/**
 * Cloudflare Pages Function - 处理邮件并提取验证码
 * 检查新邮件，提取验证码，发送 Telegram 通知
 */

// 正则表达式模板配置
const DEFAULT_TEMPLATES = [
  { name: "验证码提取", pattern: /验证码[：:]\s*(\d+)/g },
  { name: "验证码提取2", pattern: /验证码为[：:]\s*(\d+)/g },
  { name: "验证码提取3", pattern: /(\d{4,8})\s*为您的验证码/g },
  { name: "验证码提取 - code is", pattern: /code[：:\s&nbsp;]+is[：:\s&nbsp;]+(\d{4,8})/gi },
  { name: "验证码提取 - 简单code", pattern: /code[：:]\s*(\d{4,8})/gi },
  { name: "验证码提取 - verification code", pattern: /verification\s+code[：:\s]+(\d{4,8})/gi },
  { name: "验证码提取 - recovery code", pattern: /recovery\s+code[：:\s-]+(\d{4,8})/gi },
  { name: "验证码提取 - 纯6位数字", pattern: /\b(\d{6})\b/g }
];

// 从 HTML 中提取文本
function extractTextFromHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// 提取验证码
function extractCode(mail) {
  const subject = mail.subject || '';
  const textContent = mail.text || '';
  const htmlContent = mail.html ? extractTextFromHtml(mail.html) : '';
  const fullContent = `${subject}\n${textContent}\n${htmlContent}`;

  for (const template of DEFAULT_TEMPLATES) {
    const matches = [...fullContent.matchAll(template.pattern)];
    if (matches.length > 0 && matches[0][1]) {
      return {
        code: matches[0][1],
        template: template.name,
        from: mail.from,
        subject: mail.subject
      };
    }
  }

  return null;
}

// 发送 Telegram 通知
async function sendTelegramNotification(botToken, chatId, extracted) {
  const message = `🔐 验证码: ${extracted.code}\n\n来源: ${extracted.from}\n主题: ${extracted.subject}\n模板: ${extracted.template}`;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message
    })
  });

  return response.ok;
}

export async function onRequestGet(context) {
  try {
    const { env } = context;

    // 配置
    const WORKER_URL = env.WORKER_URL || '';
    const API_TYPE = env.API_TYPE || 'admin';
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || '';
    const JWT_PASSWORD = env.JWT_PASSWORD || '';
    const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || '';
    const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID || '';
    const ALLOWED_SENDERS = env.ALLOWED_SENDERS ? env.ALLOWED_SENDERS.split(',') : [];

    if (!WORKER_URL) {
      return new Response(JSON.stringify({
        success: false,
        error: 'WORKER_URL not configured'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 构建请求 URL
    let apiUrl = '';
    let headers = { 'Content-Type': 'application/json' };

    if (API_TYPE === 'admin') {
      apiUrl = `${WORKER_URL}/admin/mails?limit=10&offset=0`;
      headers['x-admin-auth'] = ADMIN_PASSWORD;
    } else if (API_TYPE === 'user') {
      apiUrl = `${WORKER_URL}/user_api/mails?limit=10&offset=0`;
      headers['x-admin-auth'] = ADMIN_PASSWORD;
    } else {
      apiUrl = `${WORKER_URL}/api/mails?limit=10&offset=0`;
      headers['Authorization'] = `Bearer ${JWT_PASSWORD}`;
    }

    // 获取邮件
    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Mail API returned ${response.status}`
      }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    const mailData = await response.json();
    const mails = mailData.results || mailData.data || [];

    // 过滤发件人
    let filteredMails = mails;
    if (ALLOWED_SENDERS.length > 0) {
      filteredMails = mails.filter(mail =>
        ALLOWED_SENDERS.some(sender => mail.from?.includes(sender))
      );
    }

    // 处理邮件
    const processedMails = [];
    const processedIds = new Set(
      (await env.MAIL_KV?.get('processed_mail_ids', { type: 'json' })) || []
    );

    for (const mail of filteredMails) {
      const mailId = mail.id || mail.message_id;

      // 检查是否已处理
      if (processedIds.has(mailId)) {
        continue;
      }

      // 提取验证码
      const extracted = extractCode(mail);

      if (extracted) {
        // 保存到 KV
        await env.MAIL_KV?.put('latest_code', extracted.code);
        await env.MAIL_KV?.put('latest_code_timestamp', new Date().toISOString());

        // 发送 Telegram 通知
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          await sendTelegramNotification(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, extracted);
        }

        processedMails.push(extracted);

        // 标记为已处理
        processedIds.add(mailId);
      } else {
        // 即使没匹配也标记为已处理
        processedIds.add(mailId);
      }
    }

    // 保存已处理的邮件 ID（限制数量避免存储过大）
    const idsArray = Array.from(processedIds).slice(-1000);
    await env.MAIL_KV?.put('processed_mail_ids', JSON.stringify(idsArray));

    return new Response(JSON.stringify({
      success: true,
      processed: processedMails.length,
      total_mails: mails.length,
      filtered_mails: filteredMails.length,
      results: processedMails
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
