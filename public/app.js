// 前端 JavaScript 逻辑

// 工具函数：格式化日期
function formatDate(dateString) {
    if (!dateString) return '未知时间';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 工具函数：截取文本
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// 工具函数：从 HTML 提取纯文本
function extractTextFromHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

// 获取最新验证码
async function getLatestCode() {
    const display = document.getElementById('latest-code-display');
    const btn = document.getElementById('get-latest-code');

    btn.disabled = true;
    display.innerHTML = '<div class="loading">正在获取...</div>';

    try {
        const response = await fetch('/api/latest-code');
        const data = await response.json();

        console.log('Latest code response:', data); // 调试日志

        if (data.success && data.code) {
            // 确保 code 是字符串
            const codeStr = typeof data.code === 'object' ? JSON.stringify(data.code) : String(data.code);

            display.innerHTML = `
                <div>
                    <div class="code-value">${codeStr}</div>
                    <div class="code-meta">
                        <p>获取时间: ${formatDate(data.timestamp)}</p>
                        <p>来源: ${data.source || 'unknown'}</p>
                    </div>
                </div>
            `;
        } else if (data.error) {
            display.innerHTML = `<div class="error">错误: ${data.error}</div>`;
        } else {
            display.innerHTML = `<div class="error">${data.message || '暂无验证码'}</div>`;
        }
    } catch (error) {
        console.error('Get latest code error:', error);
        display.innerHTML = `<div class="error">获取失败: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
    }
}

// 处理邮件
async function processMails() {
    const statusDisplay = document.getElementById('process-status');
    const resultsDisplay = document.getElementById('process-results');
    const btn = document.getElementById('process-mails');

    btn.disabled = true;
    statusDisplay.className = 'status-display';
    statusDisplay.innerHTML = '<p>正在处理邮件...</p>';
    resultsDisplay.innerHTML = '';

    try {
        const response = await fetch('/api/process-mails');
        const data = await response.json();

        if (data.success) {
            statusDisplay.className = 'status-display success';
            statusDisplay.innerHTML = `
                <p>✅ 处理完成</p>
                <p>总邮件数: ${data.total_mails} | 过滤后: ${data.filtered_mails} | 提取到: ${data.processed}</p>
            `;

            if (data.results && data.results.length > 0) {
                resultsDisplay.innerHTML = data.results.map(item => `
                    <div class="result-item">
                        <strong>验证码: ${item.code}</strong>
                        <p>来源: ${item.from}</p>
                        <p>主题: ${item.subject}</p>
                        <p>模板: ${item.template}</p>
                    </div>
                `).join('');
            } else {
                resultsDisplay.innerHTML = '<p style="color: #6c757d; margin-top: 10px;">未提取到新验证码</p>';
            }
        } else {
            statusDisplay.className = 'status-display error';
            statusDisplay.innerHTML = `<p>❌ 处理失败: ${data.error}</p>`;
        }
    } catch (error) {
        statusDisplay.className = 'status-display error';
        statusDisplay.innerHTML = `<p>❌ 请求失败: ${error.message}</p>`;
    } finally {
        btn.disabled = false;
    }
}

// 获取邮件列表
async function getMails() {
    const mailsList = document.getElementById('mails-list');
    const btn = document.getElementById('get-mails');
    const limit = document.getElementById('mail-limit').value;
    const address = document.getElementById('mail-address').value;

    btn.disabled = true;
    mailsList.innerHTML = '<div class="loading">正在加载邮件...</div>';

    try {
        let url = `/api/get-mails?limit=${limit}&offset=0`;
        if (address) {
            url += `&address=${encodeURIComponent(address)}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            const mails = result.data.results || result.data.data || [];

            if (mails.length === 0) {
                mailsList.innerHTML = '<p style="color: #6c757d;">暂无邮件</p>';
                return;
            }

            mailsList.innerHTML = mails.map(mail => {
                const textContent = mail.text || extractTextFromHtml(mail.html) || '';
                const preview = truncateText(textContent);

                return `
                    <div class="mail-item">
                        <div class="mail-header">
                            <div class="mail-from">${mail.from || '未知发件人'}</div>
                            <div class="mail-date">${formatDate(mail.created_at || mail.date)}</div>
                        </div>
                        <div class="mail-subject">${mail.subject || '(无主题)'}</div>
                        <div class="mail-preview">${preview}</div>
                    </div>
                `;
            }).join('');
        } else {
            mailsList.innerHTML = `<div class="error">获取失败: ${result.error}</div>`;
        }
    } catch (error) {
        mailsList.innerHTML = `<div class="error">请求失败: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
    }
}

// 事件监听
document.addEventListener('DOMContentLoaded', function() {
    // 绑定按钮事件
    document.getElementById('get-latest-code').addEventListener('click', getLatestCode);
    document.getElementById('process-mails').addEventListener('click', processMails);
    document.getElementById('get-mails').addEventListener('click', getMails);

    // 自动加载一次邮件列表
    // getMails();
});
