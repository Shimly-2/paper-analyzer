const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TOKEN_FILE = path.join(__dirname, '..', 'config', 'mineru_token.txt');
const MINIMAX_TOKEN_FILE = path.join(__dirname, '..', 'config', 'minimax_token.txt');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'scripts', 'mineru_client.py');

function getToken(file) {
    try {
        if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    } catch(e) {}
    return null;
}

function parseWithPython(arxivId, callback) {
    const proc = spawn('python3', ['-u', PYTHON_SCRIPT, '--arxiv', arxivId, '--output', '/tmp'], { cwd: path.dirname(PYTHON_SCRIPT) });
    let output = '', error = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => error += d);
    proc.on('close', () => {
        if (fs.existsSync('/tmp/paper.md')) {
            callback(null, fs.readFileSync('/tmp/paper.md', 'utf8'));
        } else {
            callback(error || '解析失败', null);
        }
    });
}


function getArxivInfo(arxivId, callback) {
    https.get('https://export.arxiv.org/api/query?id_list='+arxivId, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            // Get the second title (entry title, not feed title)
            const titles = data.match(/<title>([^<]+)<\/title>/g);
            const title = titles && titles[1] ? titles[1].replace(/<\/?title>/g, '').trim().replace(/\s+/g, ' ') : '';
            const abstracts = data.match(/<summary>([^<]+)<\/summary>/g);
            const abstract = abstracts && abstracts[0] ? abstracts[0].replace(/<\/?summary>/g, '').trim().replace(/\s+/g, ' ') : '';
            callback({ title, abstract });
        });
    }).on('error', () => callback({ title:'', abstract:'' }));
}

function callMiniMax(prompt, systemPrompt, callback) {
    const token = getToken(MINIMAX_TOKEN_FILE);
    if (!token) { callback({error:'未配置MiniMax API Key'}); return; }
    
    const postData = JSON.stringify({
        model: 'MiniMax-M2.5',
        messages: [
            {role:'system', content: systemPrompt},
            {role:'user', content: prompt}
        ],
        max_tokens: 196608,
        temperature: 0.7
    });
    
    const options = {
        hostname: 'api.minimax.chat',
        path: '/v1/text/chatcompletion_v2',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.choices && json.choices[0]) {
                    callback({success:true, text: json.choices[0].message.content});
                } else {
                    callback({error: JSON.stringify(json)});
                }
            } catch(e) { callback({error: e.message}); }
        });
    });
    req.on('error', e => callback({error: e.message}));
    req.write(postData);
    req.end();
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    
    const url = new URL(req.url, 'http://localhost');
    
    // Parse
    if (url.pathname === '/api/parse' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const source = data.source || data.arxivId;
                if (!source) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:'no source'})); return; }
                
                let arxivId = source;
                if (source.includes('arxiv.org/pdf')) arxivId = source.replace('https://arxiv.org/pdf/','').replace('.pdf','');
                
                // First try to get title from arXiv API
                getArxivInfo(arxivId, (info) => {
                    parseWithPython(arxivId, (err, markdown) => {
                        if (err) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:err})); }
                        else { 
                            // Use first # heading as title if API didn't return one
                            let title = info.title;
                            if (!title && markdown) {
                                const match = markdown.match(/^#\s+(.+)$/m);
                                if (match) title = match[1].trim();
                            }
                            res.writeHead(200, {'Content-Type':'application/json'}); 
                            res.end(JSON.stringify({success:true, data:{id:arxivId, title:title, abstract:info.abstract, markdown:markdown}})); 
                        }
                    });
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
    // Translate
    if (url.pathname === '/api/translate' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { text, title } = JSON.parse(body);
                if (!text) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:'no text'})); return; }
                
                const prompt = `请将以下HTML格式的学术论文内容翻译成中文。

**重要规则：**
1. 只翻译HTML中的文本内容，不要修改任何HTML标签和结构
2. 保持所有HTML标签（<h1>、<h2>、<p>、<ul>、<li>、<table>、<tr>、<td>、<img>、<div>等）完全不变
3. 保持KaTeX公式（$$...$$ 和 $...$）完全不变，不翻译
4. 保持图片URL完全不变
5. 翻译文本时保持原来的段落结构和换行

**禁止：**
- 不要添加或删除任何HTML标签
- 不要修改任何标签的属性（如src、style等）
- 不要改变HTML的结构

输入的HTML：${text}`;

                callMiniMax(prompt, '你是一个专业的学术论文翻译助手。只翻译HTML中的文本，保持所有HTML标签、公式（$$和$）、图片URL不变。保持原有结构和格式。', (result) => {
                    res.writeHead(200, {'Content-Type':'application/json'});
                    res.end(JSON.stringify(result.success ? {success:true, text:result.text} : {success:false, error:result.error}));
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
    // Analyze
    if (url.pathname === '/api/analyze' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { title, abstract, content } = JSON.parse(body);
                if (!content) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:'no content'})); return; }
                
                const prompt = `请对以下学术论文进行深度分析，包括：\n\n1. 研究背景与动机\n2. 核心创新点\n3. 方法论\n4. 实验结果\n5. 局限性\n6. 潜在应用方向\n\n论文标题: ${title || ''}\n\n摘要: ${abstract || ''}\n\n正文: ${content}`;
                callMiniMax(prompt, '你是一个专业的AI学术论文分析师，擅长深度分析论文的核心贡献、方法论和价值。', (result) => {
                    res.writeHead(200, {'Content-Type':'application/json'});
                    res.end(JSON.stringify(result.success ? {success:true, text:result.text} : {success:false, error:result.error}));
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
    // Peer Review
    if (url.pathname === '/api/peerReview' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { title, abstract, content } = JSON.parse(body);
                if (!content) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:'no content'})); return; }
                
                const prompt = `请用中文对以下学术论文进行**同行评审**（Peer Review），按照以下结构进行系统性评估：

## 1. 初始评估
- 核心研究问题是什么？
- 主要发现和结论是什么？
- 工作是否具有科学性和显著性？
- 是否适合目标期刊？

## 2. 逐节详细评审

### 摘要和标题
- 摘要是否准确反映研究内容？
- 标题是否具体、准确、信息丰富？

### 引言
- 背景信息是否充分且最新？
- 研究问题是否有明确的动机和依据？
- 工作的原创性和重要性是否清晰阐述？

### 方法
- 研究是否可重复？
- 方法是否适合解决研究问题？
- 协议、试剂、设备和参数是否充分描述？
- 统计方法是否适当、清晰描述和合理？

### 结果
- 结果呈现是否清晰合乎逻辑？
- 图表是否适当、清晰、正确标注？
- 统计结果是否正确报告（效应量、置信区间、p值）？

### 讨论
- 结论是否有数据支持？
- 是否承认和讨论了研究局限性？
- 发现是否适当置于现有文献中？

## 3. 方法学和统计严谨性
- 统计假设是否满足？
- 是否报告了效应量以及p值？
- 是否进行了多次比较校正？
- 样本量是否有功效分析支持？

## 4. 可重复性和透明度
- 数据是否存放在适当仓库？
- 代码是否可用？

## 5. 总体评估
- 优势有哪些？
- 主要弱点有哪些？
- 建议修改意见？

**重要：**
1. 输出纯HTML格式，保持纵向文档流
2. 使用<h1><h2><h3>标题标签
3. 段落用<p>，列表用<ul><li>
4. 不要使用flex/grid/float布局

论文标题: ${title || ''}
摘要: ${abstract || ''}
正文: ${content}`;

                callMiniMax(prompt, '你是一个专业的学术论文同行评审专家。系统评估论文的方法学、统计严谨性、结果报告和研究价值。输出结构化HTML格式。', (result) => {
                    res.writeHead(200, {'Content-Type':'application/json'});
                    res.end(JSON.stringify(result.success ? {success:true, text:result.text} : {success:false, error:result.error}));
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
    // Semantic Search
    if (url.pathname === '/api/semanticSearch' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { query, sort } = JSON.parse(body);
                if (!query) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:'no query'})); return; }
                
                // Call Semantic Scholar API with multiple queries for more results
                const https = require('https');
                const apiUrl = 'api.semanticscholar.org';
                
                // Fetch from multiple offsets and sort methods
                const sortMethod = sort || 'citationCount';
                const queries = [
                    '/graph/v1/paper/search?query=' + encodeURIComponent(query) + '&limit=100&offset=0&sort=' + sortMethod + '&fields=paperId,title,authors,year,citationCount,venue,abstract,url,externalIds'
                ];
                
                let allPapers = [];
                let completed = 0;
                
                queries.forEach((apiPath, idx) => {
                    https.get('https://' + apiUrl + apiPath, (apiRes) => {
                        let data = '';
                        apiRes.on('data', chunk => data += chunk);
                        apiRes.on('end', () => {
                            try {
                                const json = JSON.parse(data);
                                const papers = (json.data || []).map(p => {
                                    const arxivId = p.externalIds && p.externalIds.ArXiv;
                                    return {
                                        paperId: arxivId || p.paperId || '',
                                        title: p.title || '',
                                        abstract: (p.abstract || '').substring(0, 500),
                                        year: p.year || 2024,
                                        citationCount: p.citationCount || 0,
                                        authors: (p.authors || []).slice(0, 5).map(a => a.name),
                                        url: p.url || '',
                                        hasArxiv: !!arxivId
                                    };
                                });
                                allPapers = allPapers.concat(papers);
                            } catch(e) {}
                            completed++;
                            if (completed === queries.length) {
                                // Sort by user choice
                                if (sort === 'year') {
                                    allPapers.sort((a, b) => (b.year || 0) - (a.year || 0));
                                } else if (sort === 'relevance') {
                                    // Keep original order for relevance
                                } else {
                                    allPapers.sort((a, b) => b.citationCount - a.citationCount);
                                }
                                res.writeHead(200, {'Content-Type':'application/json'});
                                res.end(JSON.stringify({success:true, papers:allPapers.slice(0, 100)}));
                            }
                        });
                    }).on('error', () => {
                        completed++;
                        if (completed === queries.length) {
                            res.writeHead(200, {'Content-Type':'application/json'});
                            res.end(JSON.stringify({success:true, papers:allPapers.slice(0, 200)}));
                        }
                    });
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
    // Convert markdown to HTML with MiniMax
    if (url.pathname === '/api/convert' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { markdown, title } = JSON.parse(body);
                if (!markdown) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:'no markdown'})); return; }
                
                const prompt = `请将以下学术论文的Markdown内容转换为完整HTML格式。

**必须遵循的格式规范（非常重要）：**
1. 只输出纯HTML内容，不要任何解释或markdown代码块标记
2. 所有内容必须是纵向排列的块级元素
3. 禁止使用flex、grid、float布局
4. **公式必须使用KaTeX语法**：
   **重要：必须使用KaTeX来在HTML中渲染公式**
在HTML的<head>或<body>开始处添加：
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script>renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}]});</script>

- 块级公式（独立一行）：用 $$公式$$，使用KaTeX来在HTML中渲染公式，KaTeX会自动渲染为行间公式（display模式）
- 行内公式（句子中）：用 $公式$，使用KaTeX来在HTML中渲染公式，KaTeX会自动渲染为行内公式
   - KaTeX会自动渲染公式
5. 图片URL：http://192.168.3.24:5001/api/images/图片名.jpg
6. 表格：<table border="1" style="border-collapse:collapse;width:100%;margin:12px 0;background:#2d2d2d;color:#f8f8f2;border-radius:8px"><tr style="background:#1a1a1a"><td style="padding:12px;border:1px solid #444;font-weight:bold">表头</td></tr><tr><td style="padding:12px;border:1px solid #444">内容</td></tr></table>
7. 段落：<p style="margin:12px 0;line-height:1.8">文字</p>
8. 列表：<ul><li>项目</li></ul>
9. 标题：<h1 style="font-size:24px;margin:16px 0">、<h2 style="font-size:20px;margin:14px 0">、<h3 style="font-size:16px;margin:12px 0">
10. 图片：<p style="text-align:center"><img src="URL" style="max-width:100%"></p>
11. 代码块（bash/命令行）：<pre style="background:#2d2d2d;color:#f8f8f2;padding:16px;border-radius:8px;overflow-x:auto;line-height:1.5;font-family:monospace">代码</pre>

**禁止：**
- flex、grid、float
- markdown代码块标记\`\`\`
- 任何行内样式display:flex/grid

**标准输出格式：**
<h1 style="font-size:24px;margin:16px 0;font-weight:bold">论文标题</h1>
<p style="margin:12px 0;line-height:1.8">段落内容</p>
<h2 style="font-size:20px;margin:14px 0;font-weight:bold">章节标题</h2>
<div style="text-align:center;margin:16px 0">$$公式$$</div>
<p style="text-align:center"><img src="http://192.168.3.24:5001/api/images/xxx.jpg" style="max-width:100%"></p>
<table style="width:100%;border-collapse:collapse;margin:12px 0"><tr><td style="padding:8px;border:1px solid #ddd">内容</td></tr></table>
<ul style="margin:12px 0;padding-left:24px"><li>列表项</li></ul>

论文标题: ${title || ''}
内容：${markdown}`;

                callMiniMax(prompt, '你是一个严格的HTML转换器。只输出纯HTML块级元素，使用KaTeX公式语法（$$块级$，行内$）。所有内容从上到下纵向排列。图片URL用http://192.168.3.24:5001/api/images/图片名.jpg。禁止flex/grid/float布局。', (result) => {
                    res.writeHead(200, {'Content-Type':'application/json'});
                    res.end(JSON.stringify(result.success ? {success:true, text:result.text} : {success:false, error:result.error}));
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
    // Chat
    if (url.pathname === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { message, context } = JSON.parse(body);
                if (!message) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:'no message'})); return; }
                
                const prompt = `论文上下文:\n${context || '无'}\n\n用户问题: ${message}\n\n请根据论文内容回答用户的问题。`;
                callMiniMax(prompt, '你是一个专业的学术论文助手，擅长回答关于论文内容的问题。用中文回答。', (result) => {
                    res.writeHead(200, {'Content-Type':'application/json'});
                    res.end(JSON.stringify(result.success ? {success:true, text:result.text} : {success:false, error:result.error}));
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
// Search for arXiv ID by title using MiniMax
    if (url.pathname === '/api/searchArxiv' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { title } = JSON.parse(body);
                if (!title) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:'no title'})); return; }
                
                const prompt = `请根据以下论文标题搜索对应的arXiv ID。

论文标题: ${title}

请直接返回arXiv ID（如 2503.14443），不要返回其他内容。如果没有找到arXiv ID，请返回 "无"。`;

                callMiniMax(prompt, '你是一个学术论文搜索引擎，擅长根据论文标题查找arXiv ID。只返回arXiv ID（如1706.03762），格式为4位年份.4-5位数字，不要其他内容。如果没有找到arXiv ID，请直接返回"无"。', (result) => {
                    if (result.success && result.text) {
                        // Extract arXiv ID
                        let arxivId = result.text.match(/(\d{4}\.\d{4,5})/);
                        res.writeHead(200, {'Content-Type':'application/json'});
                        res.end(JSON.stringify({success:true, arxivId: arxivId ? arxivId[1] : null}));
                    } else {
                        res.writeHead(200, {'Content-Type':'application/json'});
                        res.end(JSON.stringify({success:false, error:result.error}));
                    }
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
    // Check tokens
    if (url.pathname === '/api/token' && req.method === 'GET') {
        const mineru = getToken(TOKEN_FILE);
        const minimax = getToken(MINIMAX_TOKEN_FILE);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({success:true, mineru:!!mineru, minimax:!!minimax}));
        return;
    }
    
    // Serve images
    if (url.pathname.startsWith('/api/images/')) {
        const imgName = url.pathname.replace('/api/images/', '');
        const imgPath = path.join('/tmp', 'images', imgName);
        fs.readFile(imgPath, (err, data) => {
            if (err) { res.writeHead(404); res.end('Not found'); }
            else {
                const ext = path.extname(imgName).toLowerCase();
                const ct = ext === '.png' ? 'image/png' : 'image/jpeg';
                res.writeHead(200, {'Content-Type': ct});
                res.end(data);
            }
        });
        return;
    }
    
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({service:'Paper Analyzer API'}));
});


server.listen(5001, '0.0.0.0', () => console.log('Server: http://0.0.0.0:5001'));
