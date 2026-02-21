/**
 * Paper Analyzer - MinerU API Service (Node.js)
 * 调用 Python 脚本进行 PDF 解析
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 5001;
const TOKEN_FILE = path.join(__dirname, '..', 'config', 'mineru_token.txt');
const PYTHON_SCRIPT = path.join(__dirname, 'mineru_client.py');

// 获取 token
function getMineruToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        }
    } catch (e) {}
    return null;
}

// 调用 Python 解析
function parseWithPython(arxivId, callback) {
    const args = ['-u', PYTHON_SCRIPT, '--arxiv', arxivId, '--output', '/tmp'];
    
    const proc = spawn('python3', args, {
        cwd: path.dirname(PYTHON_SCRIPT)
    });
    
    let output = '';
    let error = '';
    
    proc.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
        error += data.toString();
    });
    
    proc.on('close', (code) => {
        if (code === 0) {
            const mdFile = '/tmp/paper.md';
            if (fs.existsSync(mdFile)) {
                const content = fs.readFileSync(mdFile, 'utf8');
                callback(null, { success: true, markdown: content });
            } else {
                callback(null, { success: true, output });
            }
        } else {
            callback(error || '解析失败', null);
        }
    });
}

// 获取 arXiv 论文信息 (同步版本)
function getArxivInfoSync(arxivId, callback) {
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
                const authorsMatch = data.match(/<name>([^<]+)<\/name>/g);
                
                const authors = authorsMatch ? authorsMatch.map(m => m.replace(/<\/?name>/g, '')) : [];
                
                if (titleMatch) {
                    callback(null, {
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
                    callback(null, { success: false, error: '未找到论文' });
                }
            } catch (e) {
                callback(e, null);
            }
        });
    }).on('error', (e) => {
        callback(e, null);
    });
}

// HTTP 服务器
const server = http.createServer((req, res) => {
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
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { sourceType, source } = data;
                const token = getMineruToken();
                
                if (!token) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '未配置 MinerU token' }));
                    return;
                }
                
                let arxivId = null;
                if (sourceType === 'arxiv') {
                    arxivId = source;
                } else if (sourceType === 'url' && source.includes('arxiv.org/pdf/')) {
                    arxivId = source.replace('https://arxiv.org/pdf/', '').replace('.pdf', '');
                }
                
                if (!arxivId) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '仅支持 arXiv 论文解析' }));
                    return;
                }
                
                // 获取论文信息
                getArxivInfoSync(arxivId, (err, paperInfo) => {
                    // 调用 Python 解析
                    parseWithPython(arxivId, (parseErr, result) => {
                        if (parseErr) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: parseErr }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: true,
                                data: {
                                    ...(paperInfo && paperInfo.data ? paperInfo.data : {}),
                                    markdown: result.markdown
                                }
                            }));
                        }
                    });
                });
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
    
    // API: 获取 arXiv 信息
    if (pathname === '/api/arxiv/info' && req.method === 'GET') {
        const arxivId = url.searchParams.get('id');
        if (arxivId) {
            getArxivInfoSync(arxivId, (err, result) => {
                if (err) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                }
            });
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '缺少 id 参数' }));
        }
        return;
    }
    
    // 默认返回信息
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        service: 'Paper Analyzer API',
        version: '1.0.0',
        mineru: getMineruToken() ? '已配置' : '未配置'
    }));
});

const port = process.env.PORT || DEFAULT_PORT;
server.listen(port, '0.0.0.0', () => {
    console.log(`Paper Analyzer API 服务已启动: http://localhost:${port}`);
    console.log(`MinerU Token: ${getMineruToken() ? '已配置' : '未配置'}`);
});

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});
