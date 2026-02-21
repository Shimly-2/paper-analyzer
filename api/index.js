const https = require('https');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const url = new URL(req.url, `https://${req.headers.host}`);
    const pathname = url.pathname;
    
    // Token from env
    const token = process.env.MINERU_TOKEN;
    
    // API: 解析论文
    if (pathname === '/api/parse' && req.method === 'POST') {
        const body = req.body || {};
        const { sourceType, source } = body;
        
        let arxivId = null;
        if (sourceType === 'arxiv') {
            arxivId = source;
        } else if (source && source.includes('arxiv.org/pdf')) {
            arxivId = source.replace('https://arxiv.org/pdf/', '').replace('.pdf', '');
        }
        
        if (!arxivId) {
            res.status(200).json({ success: false, error: '仅支持 arXiv 论文' });
            return;
        }
        
        if (!token) {
            res.status(200).json({ success: false, error: '未配置 MINERU_TOKEN' });
            return;
        }
        
        // 1. 提交解析任务
        const postData = JSON.stringify({
            url: `https://arxiv.org/pdf/${arxivId}.pdf`,
            model_version: 'vlm'
        });
        
        const options = {
            hostname: 'mineru.net',
            path: '/api/v4/extract/task',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const result = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
        
        if (result.status !== 200) {
            res.status(200).json({ success: false, error: '提交任务失败' });
            return;
        }
        
        let taskResult;
        try {
            taskResult = JSON.parse(result.data);
        } catch (e) {
            res.status(200).json({ success: false, error: '解析响应失败' });
            return;
        }
        
        if (taskResult.code !== 0) {
            res.status(200).json({ success: false, error: taskResult.msg });
            return;
        }
        
        const taskId = taskResult.data.task_id;
        
        // 2. 轮询等待结果
        for (let i = 0; i < 40; i++) {
            await new Promise(r => setTimeout(r, 3000));
            
            const pollResult = await new Promise((resolve, reject) => {
                const req = https.request({
                    hostname: 'mineru.net',
                    path: `/api/v4/extract/task/${taskId}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ status: res.statusCode, data }));
                });
                req.on('error', reject);
                req.end();
            });
            
            if (pollResult.status === 200) {
                try {
                    const pollData = JSON.parse(pollResult.data);
                    const state = pollData.data?.state;
                    
                    if (state === 'done') {
                        // 3. 获取论文信息
                        const arxivInfo = await getArxivInfo(arxivId);
                        
                        // 返回成功（不带完整 markdown，因为 serverless 超时）
                        res.status(200).json({
                            success: true,
                            data: {
                                id: arxivId,
                                title: arxivInfo.title || '论文',
                                abstract: arxivInfo.abstract || '',
                                message: '解析成功！由于 Vercel 超时限制，请查看本地 API 服务获取完整内容。'
                            }
                        });
                        return;
                    } else if (state === 'failed') {
                        res.status(200).json({ success: false, error: '解析失败' });
                        return;
                    }
                } catch (e) {}
            }
        }
        
        res.status(200).json({ success: false, error: '解析超时' });
        return;
    }
    
    // Token 状态
    if (pathname === '/api/token' && req.method === 'GET') {
        if (token) {
            res.status(200).json({ success: true, configured: true, masked: token.substring(0, 10) + '...' });
        } else {
            res.status(200).json({ success: true, configured: false });
        }
        return;
    }
    
    res.status(200).json({ service: 'Paper Analyzer API', version: '1.0' });
};

function getArxivInfo(arxivId) {
    return new Promise((resolve) => {
        const http = require('http');
        const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
        
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const titleMatch = data.match(/<title>([^<]+)<\/title>/);
                    const summaryMatch = data.match(/<summary>([^<]+)<\/summary>/);
                    const publishedMatch = data.match(/<published>([^<]+)<\/published>/);
                    
                    resolve({
                        title: titleMatch ? titleMatch[1].trim() : '',
                        abstract: summaryMatch ? summaryMatch[1].trim() : '',
                        published: publishedMatch ? publishedMatch[1].substring(0, 10) : ''
                    });
                } catch (e) {
                    resolve({ title: '', abstract: '' });
                }
            });
        }).on('error', () => resolve({ title: '', abstract: '' }));
    });
}
