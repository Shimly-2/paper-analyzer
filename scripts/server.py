#!/usr/bin/env python3
"""
MinerU PDF 解析 API 服务
用法: python3 api/server.py
"""

import os
import json
import requests
import argparse
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import uuid
import tempfile
import shutil

app = Flask(__name__)
CORS(app)

# MinerU API 配置
MINERU_API_URL = "https://api.mineru.cn/v1/file/analyze"
MINERU_API_URL_BATCH = "https://api.mineru.cn/v1/file/batch-analyze"

# 从文件读取 token
def get_mineru_token():
    token_file = os.path.join(os.path.dirname(__file__), '..', 'config', 'mineru_token.txt')
    if os.path.exists(token_file):
        with open(token_file, 'r') as f:
            return f.read().strip()
    return None

def save_mineru_token(token):
    config_dir = os.path.join(os.path.dirname(__file__), '..', 'config')
    os.makedirs(config_dir, exist_ok=True)
    token_file = os.path.join(config_dir, 'mineru_token.txt')
    with open(token_file, 'w') as f:
        f.write(token)
    return True

def parse_pdf_with_mineru(pdf_path, token=None):
    """使用 MinerU API 解析 PDF 文件"""
    if not token:
        token = get_mineru_token()
    
    if not token:
        return {"success": False, "error": "未配置 MinerU token"}
    
    headers = {
        "Authorization": f"Bearer {token}",
    }
    
    try:
        with open(pdf_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                MINERU_API_URL,
                headers=headers,
                files=files,
                timeout=120
            )
        
        if response.status_code == 200:
            result = response.json()
            return {"success": True, "data": result}
        else:
            return {"success": False, "error": f"API错误: {response.status_code}", "detail": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

def parse_pdf_url_with_mineru(pdf_url, token=None):
    """使用 MinerU API 解析远程 PDF"""
    if not token:
        token = get_mineru_token()
    
    if not token:
        return {"success": False, "error": "未配置 MinerU token"}
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "url": pdf_url
    }
    
    try:
        response = requests.post(
            MINERU_API_URL,
            headers=headers,
            json=data,
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            return {"success": True, "data": result}
        else:
            return {"success": False, "error": f"API错误: {response.status_code}", "detail": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_arxiv_pdf_url(arxiv_id):
    """获取 arXiv 论文的 PDF 下载地址"""
    # 清理 arxiv ID
    arxiv_id = arxiv_id.strip()
    if '.pdf' in arxiv_id:
        arxiv_id = arxiv_id.replace('.pdf', '')
    
    # arXiv PDF URL
    return f"https://arxiv.org/pdf/{arxiv_id}.pdf"

@app.route('/api/parse', methods=['POST'])
def parse_paper():
    """解析论文 API"""
    data = request.get_json()
    
    token = data.get('token') or get_mineru_token()
    source_type = data.get('sourceType')  # 'pdf', 'arxiv', 'url'
    source = data.get('source')  # 文件路径、arXiv ID 或 URL
    
    if not source:
        return jsonify({"success": False, "error": "缺少 source 参数"})
    
    if not token:
        return jsonify({"success": False, "error": "未配置 MinerU token"})
    
    result = None
    
    if source_type == 'pdf':
        # 本地 PDF 文件
        if os.path.exists(source):
            result = parse_pdf_with_mineru(source, token)
        else:
            return jsonify({"success": False, "error": f"文件不存在: {source}"})
    
    elif source_type == 'arxiv':
        # arXiv 论文
        pdf_url = get_arxiv_pdf_url(source)
        result = parse_pdf_url_with_mineru(pdf_url, token)
    
    elif source_type == 'url':
        # 远程 PDF URL
        result = parse_pdf_url_with_mineru(source, token)
    
    else:
        return jsonify({"success": False, "error": f"未知的 sourceType: {source_type}"})
    
    return jsonify(result)

@app.route('/api/token', methods=['POST'])
def set_token():
    """设置 MinerU token"""
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({"success": False, "error": "缺少 token 参数"})
    
    if save_mineru_token(token):
        return jsonify({"success": True, "message": "Token 保存成功"})
    else:
        return jsonify({"success": False, "error": "Token 保存失败"})

@app.route('/api/token', methods=['GET'])
def get_token_status():
    """获取 token 状态"""
    token = get_mineru_token()
    if token:
        # 隐藏部分 token
        masked = token[:10] + "..." + token[-5:] if len(token) > 20 else "***"
        return jsonify({"success": True, "configured": True, "masked": masked})
    else:
        return jsonify({"success": True, "configured": False})

@app.route('/api/arxiv/info', methods=['GET'])
def get_arxiv_info():
    """获取 arXiv 论文信息"""
    arxiv_id = request.args.get('id')
    
    if not arxiv_id:
        return jsonify({"success": False, "error": "缺少 id 参数"})
    
    try:
        # 使用 arXiv API 获取论文信息
        import urllib.request
        import xml.etree.ElementTree as ET
        
        url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
        response = urllib.request.urlopen(url, timeout=30)
        content = response.read().decode('utf-8')
        
        root = ET.fromstring(content)
        entry = root.find('.//{http://www.w3.org/2005/Atom}entry')
        
        if entry is not None:
            title = entry.find('.//{http://www.w3.org/2005/Atom}title').text.strip()
            summary = entry.find('.//{http://www.w3.org/2005/Atom}summary').text.strip()
            authors = [a.find('.//{http://www.w3.org/2005/Atom}name').text for a in entry.findall('.//{http://www.w3.org/2005/Atom}author')]
            published = entry.find('.//{http://www.w3.org/2005/Atom}published').text[:10]
            
            return jsonify({
                "success": True,
                "data": {
                    "id": arxiv_id,
                    "title": title,
                    "abstract": summary,
                    "authors": authors,
                    "published": published,
                    "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}.pdf"
                }
            })
        else:
            return jsonify({"success": False, "error": "未找到论文"})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='MinerU PDF 解析 API')
    parser.add_argument('--port', type=int, default=5001, help='端口号')
    parser.add_argument('--token', type=str, help='MinerU API Token')
    args = parser.parse_args()
    
    if args.token:
        save_mineru_token(args.token)
        print(f"Token 已保存")
    
    print(f"启动 API 服务: http://localhost:{args.port}")
    print(f"Token 状态: {'已配置' if get_mineru_token() else '未配置'}")
    
    app.run(host='0.0.0.0', port=args.port, debug=True)
