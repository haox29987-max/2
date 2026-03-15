import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/api';

const DEFAULT_MESSAGE = {
  role: 'assistant', 
  content: '你好！我是乘风数据罗盘AI。我能“看到”你当前的页面和筛选条件，你可以直接向我提问（例如：“外部账号中播放量最高的是谁？”）。'
};

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([DEFAULT_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🚀 核心修复：监听 messages 和 isOpen，确保点开面板时立刻置底
  useEffect(() => {
    if (isOpen) {
      // 加上 50ms 延迟，确保弹窗 DOM 完全挂载并渲染完毕后再执行平滑滚动
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [messages, isOpen]);

  const getPageContext = () => {
    const path = window.location.pathname;
    const session_storage: Record<string, string | null> = {};
    
    // 收集仪表盘 dash_mem_ 和预警中心 warn_mem_ 的所有记忆状态
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('dash_mem_') || key.startsWith('warn_mem_'))) {
        session_storage[key] = sessionStorage.getItem(key);
      }
    }

    // 🔥 增强 AI 视力：如果用户在预警中心，把英文缩写翻译成中文，让 AI 更好理解
    if (path.includes('/warning')) {
      const tab = session_storage['warn_mem_tab'];
      if (tab === 'normal') session_storage['当前选中的预警分类是'] = '正常流量预警';
      if (tab === 'growth') session_storage['当前选中的预警分类是'] = '日增长极速预警';
      if (tab === 'low') session_storage['当前选中的预警分类是'] = '低播沉寂预警';
    }

    return { current_path: path, session_storage };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const context = getPageContext();
      const apiMessages = newMessages.filter((_, i) => i !== 0 || newMessages.length === 1); 
      
      const res = await api.chatWithAI(apiMessages, context);
      setMessages([...newMessages, res]);
    } catch (error) {
      setMessages([...newMessages, { role: 'assistant', content: '抱歉，网络异常或未在设置中正确配置 DeepSeek API Key。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleNewChat = () => {
    if (messages.length > 1 && window.confirm("确定要开启新对话并清空当前历史记录吗？")) {
      setMessages([DEFAULT_MESSAGE]);
    } else if (messages.length <= 1) {
      setMessages([DEFAULT_MESSAGE]);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-24 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-105 z-50 flex items-center justify-center group"
        >
          <Bot size={28} />
          <span className="absolute right-full mr-4 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
            唤醒智能数据助手
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-8 right-8 w-96 h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="bg-indigo-600 p-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <span className="font-medium text-sm">乘风数据罗盘 AI</span>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={handleNewChat} 
                className="hover:bg-indigo-500 p-1.5 rounded transition-colors flex items-center justify-center" 
                title="开启新对话 / 清空历史记录"
              >
                <Trash2 size={16} />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="hover:bg-indigo-500 p-1.5 rounded transition-colors flex items-center justify-center"
                title="最小化"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                }`}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-500 border border-slate-100 rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                  <span className="text-xs">AI 正在思考并执行数据库查询...</span>
                </div>
              </div>
            )}
            {/* 滚动锚点 */}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="直接问我关于数据的问题..."
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}