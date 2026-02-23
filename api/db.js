const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'papers.db');

const db = new sqlite3.Database(DB_PATH);

// 为没有 uuid 的旧论文生成 uuid
function migrateUuid() {
    db.all("SELECT id, arxiv, pdfUrl FROM papers WHERE uuid IS NULL OR uuid = ''", [], (err, rows) => {
        if (err) { console.error('迁移 uuid 失败:', err); return; }
        if (rows.length === 0) { console.log('所有论文已有 uuid'); return; }
        
        console.log(`正在为 ${rows.length} 篇论文生成 uuid...`);
        rows.forEach(row => {
            let uuid;
            if (row.arxiv && row.arxiv !== 'PDF') {
                uuid = 'arxiv_' + row.arxiv;
            } else if (row.pdfUrl) {
                // 用 URL 的 hash 作为 uuid
                let hash = 0;
                for (let i = 0; i < row.pdfUrl.length; i++) {
                    let char = row.pdfUrl.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                uuid = 'pdf_' + Math.abs(hash).toString(16);
            } else {
                uuid = 'legacy_' + row.id + '_' + Date.now();
            }
            
            db.run("UPDATE papers SET uuid = ? WHERE id = ?", [uuid, row.id], (err) => {
                if (err) console.error('更新 uuid 失败:', err);
            });
        });
        console.log('uuid 迁移完成');
    });
}

db.serialize(() => {
  // 论文表
  db.run(`
    CREATE TABLE IF NOT EXISTS papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      title TEXT,
      arxiv TEXT,
      pdfUrl TEXT,
      date TEXT,
      parsed INTEGER DEFAULT 0,
      original TEXT,
      translated TEXT,
      analysis TEXT,
      peerReview TEXT,
      abstract TEXT,
      tags TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('创建papers表失败:', err);
  });
  
  // 图片表 - 用 uuid 隔离不同论文
  db.run(`
    CREATE TABLE IF NOT EXISTS paper_images (
      paper_uuid TEXT NOT NULL,
      filename TEXT NOT NULL,
      data BLOB,
      mime TEXT,
      PRIMARY KEY (paper_uuid, filename)
    )
  `, (err) => {
    if (err) console.error('创建paper_images表失败:', err);
  });
  
  // 对话会话表
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      paper_id INTEGER,
      title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('创建chat_sessions表失败:', err);
  });
  
  // 消息记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_uuid TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('创建chat_messages表失败:', err);
  });
  
  // 检查并迁移旧数据
  migrateUuid();
});

module.exports = db;
