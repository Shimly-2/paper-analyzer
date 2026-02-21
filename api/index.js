module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const url = new URL(req.url, 'https://example.com');
    const token = process.env.MINERU_TOKEN;
    
    if (url.pathname === '/api/parse' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const source = data.source || data.arxivId;
                if (!source) {
                    res.status(200).json({ success: false, error: '缺少 source' });
                    return;
                }
                if (!token) {
                    res.status(200).json({ success: false, error: '未配置 token' });
                    return;
                }
                
                const arxivId = source.includes('arxiv.org') 
                    ? source.replace('https://arxiv.org/pdf/', '').replace('.pdf', '')
                    : source;
                
                // Submit task
                const postData = JSON.stringify({
                    url: 'https://arxiv.org/pdf/' + arxivId + '.pdf',
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
                
                const req = require('https').request(options, (res2) => {
                    let data2 = '';
                    res2.on('data', chunk => { data2 += chunk; });
                    res2.on('end', () => {
                        try {
                            const result = JSON.parse(data2);
                            if (result.code === 0) {
                                res.status(200).json({
                                    success: true,
                                    data: {
                                        id: arxivId,
                                        taskId: result.data.task_id,
                                        message: '任务已提交'
                                    }
                                });
                            } else {
                                res.status(200).json({ success: false, error: result.msg });
                            }
                        } catch (e) {
                            res.status(200).json({ success: false, error: e.message });
                        }
                    });
                });
                
                req.on('error', (e) => {
                    res.status(200).json({ success: false, error: e.message });
                });
                
                req.write(postData);
                req.end();
            } catch (e) {
                res.status(200).json({ success: false, error: e.message });
            }
        });
        return;
    }
    
    if (url.pathname === '/api/token') {
        res.status(200).json({ success: true, configured: !!token });
        return;
    }
    
    res.status(200).json({ service: 'Paper Analyzer' });
};
