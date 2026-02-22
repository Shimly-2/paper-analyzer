const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'papers.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // 论文表
  db.run(`
    CREATE TABLE IF NOT EXISTS papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    else console.log('数据库初始化完成:', DB_PATH);
  });
});

module.exports = db;
