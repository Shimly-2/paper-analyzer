import React, { useState } from 'react';
import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Navigation */}
      <header className="h-14 bg-gray-900 text-white flex items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-800 rounded"
          >
            ☰
          </button>
          <Link href="/" className="font-bold text-lg">
            Paper Analyzer
          </Link>
        </div>
        
        <nav className="hidden md:flex items-center gap-6 ml-8">
          <Link href="/" className="hover:text-gray-300">论文库</Link>
          <Link href="/analysis" className="hover:text-gray-300">分析报告</Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button className="p-2 hover:bg-gray-800 rounded">
            ⚙️
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Paper Library */}
        <aside 
          className={`
            ${sidebarOpen ? 'w-64' : 'w-0'} 
            lg:w-64 flex-shrink-0
            bg-gray-50 border-r border-gray-200 overflow-y-auto
            transition-all duration-300
          `}
        >
          <div className="p-3">
            <div className="relative">
              <input 
                type="text" 
                placeholder="搜索论文..." 
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          
          <div className="flex gap-1 px-2 mb-2 text-xs">
            <button className="px-2 py-1 bg-blue-100 rounded">全部</button>
            <button className="px-2 py-1 hover:bg-gray-200 rounded">Benchmark</button>
            <button className="px-2 py-1 hover:bg-gray-200 rounded">长文本</button>
          </div>

          <div className="space-y-1">
            {/* Paper items will be rendered here */}
            {children}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>

        {/* Right Sidebar - Chat */}
        <aside 
          className={`
            ${chatOpen ? 'w-80' : 'w-0'} 
            lg:w-80 flex-shrink-0
            bg-gray-50 border-l border-gray-200 overflow-y-auto
            transition-all duration-300
          `}
        >
          <div className="p-3 border-b border-gray-200">
            <h3 className="font-semibold">与 Agent 对话</h3>
          </div>
          
          <div className="p-2 space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
              这篇论文的核心创新是什么？
            </button>
            <button className="w-full text-left px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
              总结实验结果
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
