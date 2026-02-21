/**
 * Paper Analyzer - MinerU API Service (Node.js version)
 * 
 * Usage: node server.js [--port 5001]
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// 配置
const DEFAULT_PORT = 5001;
const MINERU_API_URL = 'https://api.mineru.cn/v1/file/analyze';

// Token 文件路径
const TOKEN_FILE = path.join(__dirname, '..', 'config', 'mineru_token.txt');

// 获取 token
function getMineruToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        }
    } catch (e) {
        console.error('读取token失败:', e.message);
    }
    return null;
}

// 保存 token
function saveMineruToken(token) {
    const configDir = path.join(__dirname, '..', 'config');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE, token);
    return true;
}

// 获取 arXiv 论文信息
function getArxivInfo(arxivId) {
    return new Promise((resolve, reject) => {
        const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
        
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // 简单的 XML 解析
                    const titleMatch = data.match(/<title>([^<]+)<\/title>/);
                    const summaryMatch = data.match(/<summary>([^<]+)<\/summary>/);
                    const publishedMatch = data.match(/<published>([^<]+)<\/published>/);
                    const authorsMatch = data.match(/<name>([^<]+)<\/name>/g);
                    
                    const authors = authorsMatch ? authorsMatch.map(m => m.replace(/<\/?name>/g, '')) : [];
                    
                    if (titleMatch) {
                        resolve({
                            success: true,
                            data: {
                                id: arxivId,
                                title: titleMatch[1].trim(),
                                abstract: summaryMatch ? summaryMatch[1].trim() : '',
                                authors: authors,
                                published: publishedMatch ? publishedMatch[1].substring(0, 10) : '',
                                pdf_url: `https://arxiv.org/pdf/${arxivId}.pdf`
                            }
                        });
                    } else {
                        resolve({ success: false, error: '未找到论文' });
                    }
                } catch (e) {
                    resolve({ success: false, error: e.message });
                }
            });
        }).on('error', reject);
    });
}

// 使用 MinerU 解析 PDF
function parsePdfWithMineru(pdfUrl, token) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ url: pdfUrl });
        
        const urlObj = new URL(MINERU_API_URL);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({ success: true, data: result });
                } catch (e) {
                    resolve({ success: false, error: '解析响应失败', detail: data });
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// 简单的路由处理
async function handleRequest(req, res) {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    // API: 解析论文
    if (pathname === '/api/parse' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { sourceType, source } = data;
                const token = getMineruToken();
                
                if (!token) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '未配置 MinerU token' }));
                    return;
                }
                
                let pdfUrl = '';
                if (sourceType === 'arxiv') {
                    pdfUrl = `https://arxiv.org/pdf/${source}.pdf`;
                } else if (sourceType === 'url') {
                    pdfUrl = source;
                }
                
                if (pdfUrl) {
                    const result = await parsePdfWithMineru(pdfUrl, token);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '无效的源' }));
                }
            } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    // API: 获取 token 状态
    if (pathname === '/api/token' && req.method === 'GET') {
        const token = getMineruToken();
        if (token) {
            const masked = token.length > 20 ? token.substring(0, 10) + '...' + token.substring(token.length - 5) : '***';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, configured: true, masked }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, configured: false }));
        }
        return;
    }
    
    // API: 设置 token
    if (pathname === '/api/token' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.token) {
                    saveMineruToken(data.token);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Token 保存成功' }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '缺少 token' }));
                }
            } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    // API: 获取 arXiv 信息
    if (pathname === '/api/arxiv/info' && req.method === 'GET') {
        const arxivId = url.searchParams.get('id');
        if (arxivId) {
            const result = await getArxivInfo(arxivId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '缺少 id 参数' }));
        }
        return;
    }
    
    // 默认返回 API 信息
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        service: 'Paper Analyzer API',
        version: '1.0.0',
        endpoints: [
            '/api/parse - 解析论文',
            '/api/token - 获取/设置 token',
            '/api/arxiv/info - 获取 arXiv 信息'
        ]
    }));
}

// 启动服务器
const port = process.env.PORT || DEFAULT_PORT;
const server = http.createServer(handleRequest);

server.listen(port, '0.0.0.0', () => {
    const token = getMineruToken();
    console.log(`Paper Analyzer API 服务已启动: http://localhost:${port}`);
    console.log(`MinerU Token: ${token ? '已配置' : '未配置'}`);
});

// 优雅退出
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM，正在关闭...');
    server.close(() => {
        console.log('服务已关闭');
        process.exit(0);
    });
});
