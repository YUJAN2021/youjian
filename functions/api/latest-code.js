/**
 * Cloudflare Pages Function - 获取最新验证码
 * 提供类似 code_api.py 的功能
 */

export async function onRequestGet(context) {
  try {
    const { env } = context;

    // 检查 KV 是否绑定
    if (!env.MAIL_KV) {
      return new Response(JSON.stringify({
        success: false,
        code: null,
        error: 'KV namespace not bound',
        message: 'Please bind MAIL_KV in Cloudflare Pages settings'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 从 KV 存储读取最新验证码
    let latestCode = null;
    let timestamp = null;

    try {
      latestCode = await env.MAIL_KV.get('latest_code');
      timestamp = await env.MAIL_KV.get('latest_code_timestamp');
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        code: null,
        error: 'KV read error: ' + e.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (latestCode) {
      // 确保返回的是字符串，不是对象
      const codeString = typeof latestCode === 'string' ? latestCode : String(latestCode);
      const timestampString = timestamp || new Date().toISOString();

      return new Response(JSON.stringify({
        success: true,
        code: codeString,
        source: 'kv',
        timestamp: timestampString
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      code: null,
      message: 'No code available'
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      code: null,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
