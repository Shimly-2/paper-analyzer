const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TOKEN_FILE = path.join(__dirname, '..', 'config', 'mineru_token.txt');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'scripts', 'mineru_client.py');

function getToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
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
    http.get('http://export.arxiv.org/api/query?id_list='+arxivId, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            const title = (data.match(/<title>([^<]+)<\/title>/) || ['',''])[1].trim();
            const abstract = (data.match(/<summary>([^<]+)<\/summary>/) || ['',''])[1].trim();
            callback({ title, abstract });
        });
    }).on('error', () => callback({ title:'', abstract:'' }));
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    
    const url = new URL(req.url, 'http://localhost');
    
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
                
                getArxivInfo(arxivId, (info) => {
                    parseWithPython(arxivId, (err, markdown) => {
                        if (err) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:err})); }
                        else { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:true, data:{id:arxivId, title:info.title, abstract:info.abstract, markdown:markdown}})); }
                    });
                });
            } catch(e) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:e.message})); }
        });
        return;
    }
    
    if (url.pathname === '/api/token' && req.method === 'GET') {
        const token = getToken();
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({success:true, configured:!!token}));
        return;
    }
    
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({service:'Paper Analyzer API'}));
});

server.listen(5001, '0.0.0.0', () => console.log('Server: http://0.0.0.0:5001'));
