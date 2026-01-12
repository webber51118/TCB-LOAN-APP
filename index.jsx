
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TCB_SYSTEM_PROMPT = `你是合庫貸款專家，僅根據 114.12 版規章回答。回答需包含章節引用。請以專業、親切且簡潔的口吻回答。`;

const MarkdownRenderer = ({ content }) => (
  <div className="prose prose-sm max-w-none text-[#4A4A4A] leading-relaxed muji-markdown">
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div className="overflow-x-auto my-4 border border-[#E5E5E0] rounded-sm">
            <table className="min-w-full divide-y divide-[#E5E5E0] bg-white text-xs">{children}</table>
          </div>
        ),
        h3: ({ children }) => <h3 className="text-sm font-bold text-[#00695C] mt-4 mb-2 border-l-4 border-[#00695C] pl-2">{children}</h3>,
        p: ({ children }) => <p className="mb-2 text-sm">{children}</p>,
        li: ({ children }) => <li className="mb-1 text-sm">{children}</li>,
        strong: ({ children }) => <strong className="font-bold text-[#1A1A1A]">{children}</strong>
      }}
    >{content}</ReactMarkdown>
  </div>
);

const App = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('TCB_API_KEY') || '');
  const [showKeyDialog, setShowKeyDialog] = useState(!apiKey);
  const [knowledgeBase, setKnowledgeBase] = useState(null);
  const [messages, setMessages] = useState([{ 
    id: '1', 
    role: 'assistant', 
    content: '您好，我是合庫貸款助手。\n\n請點擊右上角 **[上傳]** 按鈕，選擇 **114.12 版規章輯要 (.docx)** 檔案後，即可開始針對具體條款進行諮詢。', 
    timestamp: new Date() 
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // 檢查是否已在桌面模式
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsStandalone(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      alert("請點擊 Chrome 右上角 [⋮] 選單，選擇「安裝應用程式」或「新增至主畫面」。");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setKnowledgeBase(result.value);
      setMessages(prev => [...prev, { id: 'sys-'+Date.now(), role: 'assistant', content: `✅ **${file.name}** 已載入。\n\n我現在將嚴格遵守 114.12 版規章內容為您解答。請問您想了解哪類貸款？`, timestamp: new Date() }]);
    } catch (err) {
      alert("讀取 .docx 失敗，請確保檔案未加密且格式正確。");
    } finally {
      setIsLoading(false);
      e.target.value = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey || !knowledgeBase || isLoading) return;
    const userMsg = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...messages.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })), { role: 'user', parts: [{ text: input }] }],
        config: { 
          systemInstruction: TCB_SYSTEM_PROMPT + "\n以下為規章文本內容，請以此為唯一依據：\n" + knowledgeBase,
          temperature: 0.1
        }
      });
      setMessages(prev => [...prev, { id: 'bot-'+Date.now(), role: 'assistant', content: response.text, timestamp: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: 'err-'+Date.now(), role: 'assistant', content: "⚠️ AI 連線發生錯誤，請確認網路環境或 API Key 是否正確。", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F9F9F4] safe-top safe-bottom overflow-hidden">
      {/* API Key Modal */}
      {showKeyDialog && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl w-full max-w-xs shadow-2xl animate-in fade-in zoom-in duration-300">
            <h2 className="text-xl font-bold mb-4 text-[#00695C]">初始化助手</h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">請輸入您的 Google Gemini API Key 以啟動 AI 引擎。金鑰將儲存於您的瀏覽器本地。</p>
            <input 
              type="password" 
              className="w-full bg-[#F5F5F0] px-4 py-3 rounded-xl mb-4 text-sm focus:ring-2 focus:ring-[#00695C] outline-none" 
              placeholder="貼上 API Key..."
              onChange={(e) => {
                setApiKey(e.target.value);
                localStorage.setItem('TCB_API_KEY', e.target.value);
              }}
            />
            <button onClick={() => setShowKeyDialog(false)} className="w-full bg-[#00695C] text-white py-3.5 rounded-xl font-bold active:scale-95 transition-all">進入系統</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md px-5 py-4 border-b border-[#E5E5E0] flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#00695C] rounded-lg flex items-center justify-center text-white font-bold text-sm">合</div>
          <div>
            <h1 className="font-bold text-[#4A4A4A] text-sm leading-none">政策性貸款助手</h1>
            <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-tighter">114.12 Version Only</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isStandalone && (
            <button onClick={handleInstall} className="text-[10px] bg-[#00695C]/10 text-[#00695C] px-3 py-1.5 rounded-full font-bold active:bg-[#00695C]/20 transition-colors">
              安裝 App
            </button>
          )}
          <button onClick={() => fileInputRef.current.click()} className="p-2 bg-[#F1F1EB] rounded-full text-[#00695C] active:bg-[#E5E5E0]">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx" className="hidden" />
        </div>
      </header>

      {/* Messages */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
            <div className={`p-4 rounded-2xl max-w-[90%] shadow-sm ${m.role === 'user' ? 'bg-[#E0E0D8] text-[#4A4A4A] rounded-tr-none' : 'bg-white border border-[#E5E5E0] rounded-tl-none'}`}>
              <MarkdownRenderer content={m.content} />
              <div className="text-[8px] mt-2 opacity-20 text-right">{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white/50 border border-[#E5E5E0] px-4 py-2 rounded-full text-[10px] text-gray-400 animate-pulse">
               AI 正在檢索規章並生成建議...
             </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 bg-white border-t border-[#E5E5E0] safe-bottom">
        <div className="flex space-x-2 max-w-3xl mx-auto">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)}
            disabled={!knowledgeBase || isLoading}
            className="flex-1 bg-[#F5F5F0] px-4 py-3 rounded-xl outline-none text-sm placeholder:text-gray-400" 
            placeholder={knowledgeBase ? "請輸入問題..." : "⚠️ 請先上傳規章 (.docx)"}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading || !knowledgeBase}
            className={`px-5 rounded-xl font-bold transition-all ${!input.trim() || isLoading || !knowledgeBase ? 'bg-gray-100 text-gray-300' : 'bg-[#00695C] text-white active:scale-95'}`}
          >
            發送
          </button>
        </div>
        <p className="text-[9px] text-center text-gray-300 mt-3 font-light">僅限合庫行內規章查詢使用</p>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
