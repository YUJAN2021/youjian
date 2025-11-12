/**
 * Cloudflare Pages Function - 获取最新验证码
 * 提供类似 code_api.py 的功能
 */

export async function onRequestGet(context) {
  try {
    const { env } = context;

    // 从 KV 存储读取最新验证码
    // 注意：需要在 Cloudflare Pages 设置中绑定 KV namespace
    const latestCode = await env.MAIL_KV?.get('latest_code');
    const timestamp = await env.MAIL_KV?.get('latest_code_timestamp');

    if (latestCode) {
      return new Response(JSON.stringify({
        success: true,
        code: latestCode,
        source: 'kv',
        timestamp: timestamp || new Date().toISOString()
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
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
