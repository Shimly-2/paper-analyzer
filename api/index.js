const https = require('https');

module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const url = new URL(req.url, 'https://example.com');
    const pathname = url.pathname;
    const token = process.env.MINERU_TOKEN;
    
    if (pathname === '/api/parse' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { source } = JSON.parse(body);
                let arxivId = source;
                if (source && source.includes('arxiv.org/pdf')) {
                    arxivId = source.replace('https://arxiv.org/pdf/', '').replace('.pdf', '');
                }
                
                if (!token) {
                    res.status(200).json({ success: false, error: '未配置 token' });
                    return;
                }
                
                if (!arxivId) {
                    res.status(200).json({ success: false, error: '无效 ID' });
                    return;
                }
                
                // 提交任务
                const postData = JSON.stringify({
                    url: `https://arxiv.org/pdf/${arxivId}.pdf`,
                    model_version: 'vlm'
                });
                
                const options = {
                    hostname: 'mineru.net',
                    path: '/api/v4/extract/task',
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };
                
                const proxyReq = https.request(options, (proxyRes) => {
                    let data = '';
                    proxyRes.on('data', chunk => data += chunk);
                    proxyRes.on('end', () => {
                        try {
                            const result = JSON.parse(data);
                            if (result.code === 0) {
                                // 获取 arXiv 信息
                                getArxivInfo(arxivId, (info) => {
                                    res.status(200).json({
                                        success: true,
                                        data: {
                                            id: arxivId,
                                            title: info.title,
                                            abstract: info.abstract,
                                            taskId: result.data.task_id,
                                            message: '任务已提交'
                                        }
                                    });
                                });
                            } else {
                                res.status(200).json({ success: false, error: result.msg });
                            }
                        } catch (e) {
                            res.status(200).json({ success: false, error: e.message });
                        }
                    });
                });
                
                proxyReq.on('error', (e) => {
                    res.status(200).json({ success: false, error: e.message });
                });
                
                proxyReq.write(postData);
                proxyReq.end();
            } catch (e) {
                res.status(200).json({ success: false, error: e.message });
            }
        });
        return;
    }
    
    if (pathname === '/api/token') {
        res.status(200).json({ success: true, configured: !!token });
        return;
    }
    
    res.status(200).json({ service: 'Paper Analyzer' });
};

function getArxivInfo(arxivId, callback) {
    const http = require('http');
    http.get('http://export.arxiv.org/api/query?id_list=' + arxivId, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const title = (data.match(/<title>([^<]+)<\/title>/) || ['', ''])[1].trim();
            const abstract = (data.match(/<summary>([^<]+)<\/summary>/) || ['', ''])[1].trim();
            callback({ title, abstract });
        });
    }).on('error', () => callback({ title: '', abstract: '' }));
}
