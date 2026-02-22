#!/usr/bin/env node
/**
 * MinerU API Debug - 完整可用的解决方案
 * 
 * 使用 Python 脚本处理 PDF，因为 Node.js 的 batch upload API 有问题
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '..', 'config', 'mineru_token.txt');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'scripts', 'mineru_client.py');

function getToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        }
    } catch(e) {}
    return null;
}

/**
 * 解析 PDF - 支持本地文件或URL
 */
function parsePdf(filePathOrUrl, callback) {
    const token = getToken();
    if (!token) {
        callback('No token found', null);
        return;
    }
    
    let isUrl = filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://');
    let cmd;
    
    if (isUrl) {
        // 使用 URL 直接解析
        cmd = `cd ${path.dirname(PYTHON_SCRIPT)} && python3 mineru_client.py --url "${filePathOrUrl}" --output /tmp/mineru_result`;
    } else {
        // 本地文件 - 需要先上传
        // 由于 batch upload API 有问题，我们使用一个 workaround:
        // 将文件复制到一个可访问的位置，或者直接用 arxiv ID
        // 这里我们暂时返回错误，建议用户使用 URL
        callback('Local file upload not supported yet. Please use URL (e.g., arxiv PDF URL)', null);
        return;
    }
    
    exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
        console.log('Python output:', stdout);
        if (stderr) console.log('Python error:', stderr);
        
        if (err) {
            callback(err.message, null);
            return;
        }
        
        // 读取结果
        const resultFile = '/tmp/mineru_result/paper.md';
        if (fs.existsSync(resultFile)) {
            const markdown = fs.readFileSync(resultFile, 'utf8');
            callback(null, markdown);
        } else {
            callback('No result file found', null);
        }
    });
}

// 测试
console.log('=== Test 1: Parse arXiv URL ===');
parsePdf('https://arxiv.org/pdf/2312.09993.pdf', (err, markdown) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Success! Markdown length:', markdown.length);
        console.log('First 200 chars:', markdown.substring(0, 200));
    }
});
