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
    const token = process.env.MINERU_TOKEN;
    
    if (pathname === '/api/parse' && req.method === 'POST') {
        const body = req.body || {};
        const { source } = body;
        
        if (!token) {
            res.status(200).json({ success: false, error: '未配置 token' });
            return;
        }
        
        // 提取 arXiv ID
        let arxivId = source;
        if (source && source.includes('arxiv.org/pdf')) {
            arxivId = source.replace('https://arxiv.org/pdf/', '').replace('.pdf', '');
        }
        
        if (!arxivId) {
            res.status(200).json({ success: false, error: '无效的 arXiv ID' });
            return;
        }
        
        // 提交任务
        const postData = JSON.stringify({
            url: `https://arxiv.org/pdf/${arxivId}.pdf`,
            model_version: 'vlm'
        });
        
        try {
            const result = await fetch('https://mineru.net/api/v4/extract/task', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: postData
            });
            
            const data = await result.json();
            
            if (data) {
                //.code === 0 获取 arXiv 信息
                const arxivInfo = await getArxivInfo(arxivId);
                
                res.status(200).json({
                    success: true,
                    data: {
                        id: arxivId,
                        title: arxivInfo.title,
                        abstract: arxivInfo.abstract,
                        taskId: data.data.task_id,
                        message: '任务已提交，请在本地服务查看完整解析结果'
                    }
                });
            } else {
                res.status(200).json({ success: false, error: data.msg });
            }
        } catch (e) {
            res.status(200).json({ success: false, error: e.message });
        }
        return;
    }
    
    if (pathname === '/api/token' && req.method === 'GET') {
        res.status(200).json({ success: true, configured: !!token });
        return;
    }
    
    res.status(200).json({ service: 'Paper Analyzer API' });
};

function getArxivInfo(arxivId) {
    return new Promise((resolve) => {
        const http = require('http');
        http.get(`http://export.arxiv.org/api/query?id_list=${arxivId}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const title = (data.match(/<title>([^<]+)<\/title>/) || ['', ''])[1].trim();
                const abstract = (data.match(/<summary>([^<]+)<\/summary>/) || ['', ''])[1].trim();
                resolve({ title, abstract });
            });
        }).on('error', () => resolve({ title: '', abstract: '' }));
    });
}
