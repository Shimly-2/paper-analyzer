#!/usr/bin/env python3
"""
MinerU PDF 解析 Python 客户端 (V4 正确版)
"""

import os
import sys
import json
import time
import requests
import zipfile
import io
from typing import Optional, Dict, Any

# Token 文件路径
TOKEN_FILE = os.path.join(os.path.dirname(__file__), '..', 'config', 'mineru_token.txt')

# API 配置
MINERU_TASK_API = "https://mineru.net/api/v4/extract/task"
MINERU_RESULT_API = "https://mineru.net/api/v4/extract/task"

def get_token() -> Optional[str]:
    """获取保存的 token"""
    try:
        if os.path.exists(TOKEN_FILE):
            with open(TOKEN_FILE, 'r') as f:
                return f.read().strip()
    except Exception:
        pass
    return None

def save_token(token: str) -> bool:
    """保存 token"""
    try:
        config_dir = os.path.join(os.path.dirname(__file__), '..', 'config')
        os.makedirs(config_dir, exist_ok=True)
        with open(TOKEN_FILE, 'w') as f:
            f.write(token)
        return True
    except Exception:
        return False

def parse_url(pdf_url: str, token: Optional[str] = None, output_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    解析远程 PDF URL
    
    Args:
        pdf_url: PDF 文件 URL
        token: MinerU API Token
        output_dir: 输出目录
    
    Returns:
        解析结果字典，包含 markdown 内容
    """
    if not token:
        token = get_token()
    
    if not token:
        return {"success": False, "error": "未配置 MinerU token"}
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Step 1: 提交解析任务
    data = {
        "url": pdf_url,
        "model_version": "vlm"
    }
    
    try:
        response = requests.post(
            MINERU_TASK_API,
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code != 200:
            return {"success": False, "error": f"请求失败: {response.status_code}"}
        
        result = response.json()
        
        if result.get("code") != 0:
            return {"success": False, "error": result.get("msg", "API错误")}
        
        task_id = result["data"]["task_id"]
        
        # Step 2: 轮询等待结果
        for i in range(60):
            time.sleep(3)
            result_response = requests.get(
                f"{MINERU_RESULT_API}/{task_id}",
                headers=headers,
                timeout=30
            )
            
            if result_response.status_code == 200:
                result_data = result_response.json()
                if result_data.get("code") == 0:
                    task_state = result_data["data"].get("state")
                    
                    if task_state == "done":
                        # 下载结果 ZIP
                        zip_url = result_data["data"]["full_zip_url"]
                        zip_response = requests.get(zip_url, timeout=120)
                        
                        if zip_response.status_code == 200:
                            # 提取 markdown 和图片
                            z = zipfile.ZipFile(io.BytesIO(zip_response.content))
                            
                            markdown_content = ""
                            for name in z.namelist():
                                if name.endswith('.md'):
                                    markdown_content = z.read(name).decode('utf-8').replace(r'](images/', r'](/api/images/')
                                    break
                            
                            if not markdown_content:
                                return {"success": False, "error": "ZIP中未找到Markdown文件"}
                            
                            # 提取 images 文件夹
                            images_dir = None
                            if output_dir:
                                os.makedirs(output_dir, exist_ok=True)
                                images_dir = os.path.join(output_dir, 'images')
                                if os.path.exists(images_dir):
                                    import shutil
                                    shutil.rmtree(images_dir)
                                os.makedirs(images_dir, exist_ok=True)
                                
                                for name in z.namelist():
                                    if name.startswith('images/') and not name.endswith('/'):
                                        # 提取图片
                                        img_data = z.read(name)
                                        img_name = os.path.basename(name)
                                        img_path = os.path.join(images_dir, img_name)
                                        with open(img_path, 'wb') as f:
                                            f.write(img_data)
                                
                                # 保存 markdown
                                output_file = os.path.join(output_dir, "paper.md")
                                with open(output_file, 'w', encoding='utf-8') as f:
                                    f.write(markdown_content)
                            
                            return {
                                "success": True,
                                "data": {
                                    "markdown": markdown_content,
                                    "zip_url": zip_url,
                                    "task_id": task_id
                                }
                            }
                        else:
                            return {"success": False, "error": f"下载结果失败: {zip_response.status_code}"}
                    
                    elif task_state == "failed":
                        return {
                            "success": False,
                            "error": "解析失败",
                            "detail": result_data["data"].get("err_msg", "")
                        }
        
        return {"success": False, "error": "解析超时"}
        
    except requests.exceptions.Timeout:
        return {"success": False, "error": "请求超时"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"网络错误: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"错误: {str(e)}"}

def parse_local_file(file_path: str, token: Optional[str] = None, output_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    解析本地 PDF 文件
    
    Args:
        file_path: 本地 PDF 文件路径
        token: MinerU API Token
        output_dir: 输出目录
    
    Returns:
        解析结果字典
    """
    if not token:
        token = get_token()
    
    if not token:
        return {"success": False, "error": "未配置 MinerU token"}
    
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Step 1: 获取上传 URL
    data = {
        "files": [{"name": os.path.basename(file_path), "data_id": os.path.basename(file_path)}],
        "model_version": "vlm"
    }
    
    try:
        response = requests.post(
            "https://mineru.net/api/v4/file-urls/batch",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code != 200:
            return {"success": False, "error": f"请求失败: {response.status_code}"}
        
        result = response.json()
        
        if result.get("code") != 0:
            return {"success": False, "error": result.get("msg", "API错误")}
        
        upload_url = result["data"]["file_urls"][0]
        
        # Step 2: 上传文件
        with open(file_path, 'rb') as f:
            upload_response = requests.put(upload_url, data=f, timeout=120)
        
        if upload_response.status_code != 200:
            return {"success": False, "error": f"文件上传失败: {upload_response.status_code}"}
        
        # Step 3: 提交解析任务
        task_data = {
            "url": upload_url.split('?')[0],
            "model_version": "vlm"
        }
        
        task_response = requests.post(
            "https://mineru.net/api/v4/extract/task",
            headers=headers,
            json=task_data,
            timeout=30
        )
        
        task_result = task_response.json()
        
        if task_result.get("code") != 0:
            return {"success": False, "error": task_result.get("msg", "提交任务失败")}
        
        task_id = task_result["data"]["task_id"]
        
        # Step 4: 轮询等待结果
        for i in range(60):
            time.sleep(3)
            check_response = requests.get(
                f"https://mineru.net/api/v4/extract/task/{task_id}",
                headers=headers,
                timeout=30
            )
            
            if check_response.status_code == 200:
                check_data = check_response.json()
                if check_data.get("code") == 0:
                    state = check_data["data"].get("state")
                    
                    if state == "done":
                        # 获取完整结果
                        if check_data["data"].get("markdown"):
                            return {
                                "success": True,
                                "data": {
                                    "markdown": check_data["data"]["markdown"]
                                }
                            }
                        else:
                            return {"success": False, "error": "解析结果为空"}
                    
                    elif state == "failed":
                        return {
                            "success": False,
                            "error": "解析失败",
                            "detail": check_data["data"].get("err_msg", "")
                        }
        
        return {"success": False, "error": "解析超时"}
        
    except requests.exceptions.Timeout:
        return {"success": False, "error": "请求超时"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"网络错误: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"错误: {str(e)}"}


def parse_local_file(file_path: str, token: Optional[str] = None, output_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    解析本地 PDF 文件
    
    Args:
        file_path: 本地 PDF 文件路径
        token: MinerU API Token
        output_dir: 输出目录
    
    Returns:
        解析结果字典
    """
    if not token:
        token = get_token()
    
    if not token:
        return {"success": False, "error": "未配置 MinerU token"}
    
    if not os.path.exists(file_path):
        return {"success": False, "error": f"文件不存在: {file_path}"}
    
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Step 1: 获取上传 URL
    data = {
        "files": [{"name": os.path.basename(file_path), "data_id": os.path.basename(file_path)}],
        "model_version": "vlm"
    }
    
    try:
        response = requests.post(
            "https://mineru.net/api/v4/file-urls/batch",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code != 200:
            return {"success": False, "error": f"请求失败: {response.status_code}"}
        
        result = response.json()
        
        if result.get("code") != 0:
            return {"success": False, "error": result.get("msg", "API错误")}
        
        upload_url = result["data"]["file_urls"][0]
        
        # Step 2: 上传文件
        with open(file_path, 'rb') as f:
            upload_response = requests.put(upload_url, data=f, timeout=120)
        
        if upload_response.status_code != 200:
            return {"success": False, "error": f"文件上传失败: {upload_response.status_code}"}
        
        # Step 3: 提交解析任务
        task_data = {
            "url": upload_url.split('?')[0],
            "model_version": "vlm"
        }
        
        task_response = requests.post(
            "https://mineru.net/api/v4/extract/task",
            headers=headers,
            json=task_data,
            timeout=30
        )
        
        task_result = task_response.json()
        
        if task_result.get("code") != 0:
            return {"success": False, "error": task_result.get("msg", "提交任务失败")}
        
        task_id = task_result["data"]["task_id"]
        
        # Step 4: 轮询等待结果
        for i in range(60):
            time.sleep(3)
            check_response = requests.get(
                f"https://mineru.net/api/v4/extract/task/{task_id}",
                headers=headers,
                timeout=30
            )
            
            if check_response.status_code == 200:
                check_data = check_response.json()
                if check_data.get("code") == 0:
                    state = check_data["data"].get("state")
                    
                    if state == "done":
                        # 返回 markdown
                        markdown = check_data["data"].get("markdown", "")
                        return {
                            "success": True,
                            "data": {
                                "markdown": markdown
                            }
                        }
                    
                    elif state == "failed":
                        return {
                            "success": False,
                            "error": "解析失败",
                            "detail": check_data["data"].get("err_msg", "")
                        }
        
        return {"success": False, "error": "解析超时"}
        
    except requests.exceptions.Timeout:
        return {"success": False, "error": "请求超时"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"网络错误: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"错误: {str(e)}"}


def parse_arxiv(arxiv_id: str, token: Optional[str] = None, output_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    解析 arXiv 论文
    
    Args:
        arxiv_id: arXiv ID (如 2602.03219)
        token: MinerU API Token
        output_dir: 输出目录
    
    Returns:
        解析结果字典
    """
    pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    return parse_url(pdf_url, token, output_dir)

# CLI 入口
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="MinerU PDF 解析工具")
    parser.add_argument("--token", type=str, help="MinerU API Token")
    parser.add_argument("--arxiv", type=str, help="arXiv ID")
    parser.add_argument("--url", type=str, help="PDF URL")
    parser.add_argument("--file", type=str, help="本地 PDF 文件路径")
    parser.add_argument("--output", type=str, default="/tmp", help="输出目录")
    
    args = parser.parse_args()
    
    if args.token:
        if save_token(args.token):
            print("Token 保存成功")
        else:
            print("Token 保存失败")
            sys.exit(1)
    
    # 执行解析
    result = None
    if args.file:
        print(f"正在解析本地文件: {args.file} ...")
        result = parse_local_file(args.file, output_dir=args.output)
    elif args.arxiv:
        print(f"正在解析 arXiv: {args.arxiv} ...")
        result = parse_arxiv(args.arxiv, output_dir=args.output)
    elif args.url:
        print(f"正在解析 URL: {args.url} ...")
        result = parse_url(args.url, output_dir=args.output)
    else:
        token = get_token()
        if token:
            print(f"Token 已配置: {token[:20]}...")
        else:
            print("Token 未配置")
        sys.exit(0)
    
    if result:
        if result["success"]:
            print(f"解析成功! Markdown 长度: {len(result['data']['markdown'])}")
            if args.output:
                print(f"已保存到: {args.output}/paper.md")
        else:
            print(f"解析失败: {result.get('error')}")
    else:
        print("无解析结果")
