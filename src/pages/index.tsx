import { useState } from 'react';
import Head from 'next/head';

const papers = [
  {
    id: '1',
    title: 'Envisioning Beyond the Pixels: Benchmarking Reasoning-Informed Visual Editing',
    arxivId: '2505.10610',
    date: '2025-02-18',
    tags: ['Benchmark', 'Academic']
  },
  {
    id: '2',
    title: 'MMLongBench: Multi-modal Long Context Benchmark',
    arxivId: '2503.14443',
    date: '2025-02-15',
    tags: ['Long Content']
  },
  {
    id: '3',
    title: 'Embodied Agent Interface: A Unified Interface',
    arxivId: '2507.09063',
    date: '2025-02-10',
    tags: ['Agent']
  }
];

export default function Home() {
  const [selectedPaper, setSelectedPaper] = useState(papers[0]);
  const [viewMode, setViewMode] = useState<'read' | 'analysis'>('analysis');
  const [mobileTab, setMobileTab] = useState<'library' | 'read' | 'analysis' | 'chat'>('library');

  return (
    <>
      <Head>
        <title>Paper Analyzer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Mobile Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#25262B] border-t border-[#3A3C40] flex justify-around py-3 z-50">
        <button onClick={() => setMobileTab('library')} className={`flex flex-col items-center text-xs ${mobileTab === 'library' ? 'text-[#9B7ED9]' : 'text-gray-400'}`}>
          <span className="text-lg">📚</span>
        </button>
        <button onClick={() => setMobileTab('read')} className={`flex flex-col items-center text-xs ${mobileTab === 'read' ? 'text-[#9B7ED9]' : 'text-gray-400'}`}>
          <span className="text-lg">📖</span>
        </button>
        <button onClick={() => setMobileTab('analysis')} className={`flex flex-col items-center text-xs ${mobileTab === 'analysis' ? 'text-[#9B7ED9]' : 'text-gray-400'}`}>
          <span className="text-lg">📊</span>
        </button>
        <button onClick={() => setMobileTab('chat')} className={`flex flex-col items-center text-xs ${mobileTab === 'chat' ? 'text-[#9B7ED9]' : 'text-gray-400'}`}>
          <span className="text-lg">💬</span>
        </button>
      </div>

      <div className="flex h-screen bg-[#1A1B1E]">
        {/* Left Sidebar - Paper Library */}
        <div className={`${mobileTab === 'library' ? 'block' : 'hidden'} lg:block w-64 bg-[#25262B] border-r border-[#3A3C40] flex flex-col`}>
          <div className="p-4 border-b border-[#3A3C40]">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">论文库</h2>
            <input type="text" placeholder="搜索论文..." className="w-full text-sm" />
          </div>
          
          <div className="flex gap-2 p-3 border-b border-[#3A3C40]">
            {['全部', 'Benchmark', '长文本', 'Agent'].map((tag, i) => (
              <button key={tag} className={`px-2 py-1 rounded text-xs ${i === 0 ? 'bg-[#9B7ED9] text-white' : 'bg-[#2C2E33] text-gray-400 hover:bg-[#3A3C40]'}`}>
                {tag}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {papers.map((paper) => (
              <div 
                key={paper.id}
                onClick={() => { setSelectedPaper(paper); setMobileTab('analysis'); }}
                className={`paper-item ${selectedPaper.id === paper.id ? 'active' : ''}`}
              >
                <div className="font-medium text-sm text-white line-clamp-2">{paper.title}</div>
                <div className="text-xs text-gray-500 mt-1">arxiv:{paper.arxivId} • {paper.date}</div>
                <div className="flex gap-1 mt-2">
                  {paper.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 bg-[#2C2E33] text-gray-400 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className={`${mobileTab === 'read' || mobileTab === 'analysis' ? 'block' : 'hidden'} lg:flex-1 flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className="h-14 bg-[#25262B] border-b border-[#3A3C40] flex items-center justify-between px-4">
            <h1 className="font-semibold text-white truncate flex-1">{selectedPaper.title}</h1>
            <div className="flex gap-2">
              <button onClick={() => setViewMode('read')} className={`px-4 py-1.5 rounded-lg text-sm ${viewMode === 'read' ? 'bg-[#9B7ED9] text-white' : 'bg-[#2C2E33] text-gray-400'}`}>
                阅读
              </button>
              <button onClick={() => setViewMode('analysis')} className={`px-4 py-1.5 rounded-lg text-sm ${viewMode === 'analysis' ? 'bg-[#9B7ED9] text-white' : 'bg-[#2C2E33] text-gray-400'}`}>
                分析
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {viewMode === 'read' ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Original */}
                <div className="card p-4">
                  <h2 className="text-lg font-bold text-white mb-4">原文 (English)</h2>
                  <div className="space-y-4 text-sm text-gray-300">
                    <p><strong className="text-white">Abstract</strong><br/>We present RISEBench, a benchmark for evaluating reasoning-informed visual editing...</p>
                    <div className="bg-[#2C2E33] p-4 rounded-lg">
                      <strong className="text-white">Three-Dimensional Scoring System</strong>
                      <ol className="list-decimal ml-4 mt-2 space-y-2">
                        <li><span className="text-[#4A90D9]">Instruction Reasoning</span>: Measures if the model understands both literal and hidden intent.</li>
                        <li><span className="text-[#E8A87C]">Appearance Consistency</span>: Measures how well visual elements are preserved.</li>
                        <li><span className="text-[#C25D5D]">Visual Plausibility</span>: Evaluates the realism of the output.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Translated */}
                <div className="card p-4">
                  <h2 className="text-lg font-bold text-white mb-4">译文 (中文)</h2>
                  <div className="space-y-4 text-sm text-gray-300">
                    <p><strong className="text-white">摘要</strong><br/>我们提出了 RISEBench，一个用于评估推理感知视觉编辑的基准测试...</p>
                    <div className="bg-[#2C2E33] p-4 rounded-lg">
                      <strong className="text-white">三维度评分体系</strong>
                      <ol className="list-decimal ml-4 mt-2 space-y-2">
                        <li><span className="text-[#4A90D9]">指令推理</span>: 衡量模型是否理解编辑指令中的显式和隐含意图。</li>
                        <li><span className="text-[#E8A87C]">外观一致性</span>: 衡量视觉元素是否被很好地保留。</li>
                        <li><span className="text-[#C25D5D]">视觉合理性</span>: 评估输出的真实感。</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl">
                <h2 className="text-xl font-bold text-white mb-6">论文深度分析报告</h2>
                
                <section className="card p-5 mb-4">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#4A90D9] rounded-full"></span>
                    1. 研究动机
                  </h3>
                  <ul className="list-disc ml-4 space-y-2 text-sm text-gray-300">
                    <li>研究问题：如何评估 AI 模型在视觉编辑任务中的推理能力</li>
                    <li>研究背景：现有基准测试缺乏对推理过程的评估</li>
                    <li>现有局限性：只关注最终输出质量，忽略推理过程</li>
                  </ul>
                </section>

                <section className="card p-5 mb-4">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#E8A87C] rounded-full"></span>
                    2. 核心思想
                  </h3>
                  <ul className="list-disc ml-4 space-y-2 text-sm text-gray-300">
                    <li>核心贡献：提出三维度评分体系</li>
                    <li>创新点：引入指令推理、视觉一致性、视觉合理性三个评估维度</li>
                  </ul>
                </section>

                <section className="card p-5 mb-4">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#C25D5D] rounded-full"></span>
                    3. 算法结构
                  </h3>
                  <p className="text-sm text-gray-300">论文提出了 RISEBench 基准测试框架...</p>
                </section>

                <section className="card p-5 mb-4">
                  <h3 className="font-semibold text-white mb-3">4. 实验结论</h3>
                  <ul className="list-disc ml-4 space-y-2 text-sm text-gray-300">
                    <li>数据集：RISEBench 包含 500 个视觉编辑任务</li>
                    <li>主要结果：GPT-4V 在指令推理维度表现最好</li>
                  </ul>
                </section>

                <section className="card p-5">
                  <h3 className="font-semibold text-white mb-3">5. 创新点</h3>
                  <ol className="list-decimal ml-4 space-y-2 text-sm text-gray-300">
                    <li>首次提出推理感知视觉编辑基准</li>
                    <li>三维度评分体系设计</li>
                    <li>全面的评估框架</li>
                  </ol>
                </section>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Chat */}
        <div className={`${mobileTab === 'chat' ? 'block' : 'hidden'} lg:block w-80 bg-[#25262B] border-l border-[#3A3C40] flex flex-col`}>
          <div className="p-4 border-b border-[#3A3C40]">
            <h3 className="font-semibold text-white">与 Agent 对话</h3>
          </div>
          
          <div className="p-3 space-y-2 border-b border-[#3A3C40]">
            {['这篇论文的核心创新是什么？', '总结实验结果', '解释算法流程'].map((q, i) => (
              <button key={i} className="w-full text-left px-3 py-2 text-sm bg-[#2C2E33] text-gray-300 rounded-lg hover:bg-[#3A3C40]">
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="chat-bubble text-sm text-gray-300">
              你好！我是论文分析助手，可以回答关于这篇论文的任何问题。
            </div>
          </div>

          <div className="p-3 border-t border-[#3A3C40]">
            <div className="flex gap-2">
              <input type="text" placeholder="输入问题..." className="flex-1 text-sm" />
              <button className="btn btn-primary text-sm">发送</button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden h-16"></div>
    </>
  );
}
