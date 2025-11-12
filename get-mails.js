/**
 * Cloudflare Pages Function - 获取邮件列表
 * 从 Cloudflare Worker 邮件 API 获取邮件
 */

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    // 从环境变量获取配置
    const WORKER_URL = env.WORKER_URL || '';
    const API_TYPE = env.API_TYPE || 'admin';
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || '';
    const JWT_PASSWORD = env.JWT_PASSWORD || '';

    // 获取查询参数
    const limit = url.searchParams.get('limit') || '10';
    const offset = url.searchParams.get('offset') || '0';
    const address = url.searchParams.get('address') || '';
    const keyword = url.searchParams.get('keyword') || '';

    if (!WORKER_URL) {
      return new Response(JSON.stringify({
        success: false,
        error: 'WORKER_URL not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 构建请求 URL
    let apiUrl = '';
    let headers = { 'Content-Type': 'application/json' };

    if (API_TYPE === 'admin') {
      const params = new URLSearchParams({ limit, offset });
      if (address) params.append('address', address);
      if (keyword) params.append('keyword', keyword);
      apiUrl = `${WORKER_URL}/admin/mails?${params}`;
      headers['x-admin-auth'] = ADMIN_PASSWORD;
    } else if (API_TYPE === 'user') {
      const params = new URLSearchParams({ limit, offset });
      if (address) params.append('address', address);
      if (keyword) params.append('keyword', keyword);
      apiUrl = `${WORKER_URL}/user_api/mails?${params}`;
      headers['x-admin-auth'] = ADMIN_PASSWORD;
    } else {
      // api type
      apiUrl = `${WORKER_URL}/api/mails?limit=${limit}&offset=${offset}`;
      headers['Authorization'] = `Bearer ${JWT_PASSWORD}`;
    }

    // 请求邮件 API
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Mail API returned ${response.status}`
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      data: data
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
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
