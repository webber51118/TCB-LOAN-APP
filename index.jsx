
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
    content: '您好，我是合庫貸款助手。\n\n請點擊右上角 **[上傳]** 按鈕，選擇 **114.12 版規章輯要 (.docx)** 檔案後，即可開始諮詢。', 
    timestamp: new Date() 
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [pwaStatus, setPwaStatus] = useState('checking'); // checking, ready, installed
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // 監測是否已經安裝
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setPwaStatus('installed');
    }

    const handler = (e) => {
      console.log('PWA Install Prompt Ready');
      e.preventDefault();
      setDeferredPrompt(e);
      setPwaStatus('ready');
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    // 如果 3 秒後都沒觸發 ready，顯示引導
    const timer = setTimeout(() => {
      if (pwaStatus === 'checking') setPwaStatus('not_detected');
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setPwaStatus('installed');
      }
    } else {
      alert("⚠️ 安裝環境尚未準備好。\n請確保使用 Chrome 瀏覽器，並嘗試重新整理頁面。若仍無效，請點擊選單中的「安裝應用程式」或「新增至主畫面」。");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setKnowledgeBase(result.value);
      setMessages(prev => [...prev, { id: 'sys-'+Date.now(), role: 'assistant', content: `✅ **${file.name}** 已載入。\n\n請問您想了解哪類貸款？`, timestamp: new Date() }]);
    } catch (err) {
      alert("讀取 .docx 失敗。");
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
          systemInstruction: TCB_SYSTEM_PROMPT + "\n以下為規章內容：\n" + knowledgeBase,
          temperature: 0.1
        }
      });
      setMessages(prev => [...prev, { id: 'bot-'+Date.now(), role: 'assistant', content: response.text, timestamp: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: 'err-'+Date.now(), role: 'assistant', content: "⚠️ AI 連線發生錯誤。", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F9F9F4] safe-top safe-bottom overflow-hidden">
      {/* API Key Modal */}
      {showKeyDialog && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl w-full max-w-xs shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-[#00695C]">初始化助手</h2>
            <input 
              type="password" 
              className="w-full bg-[#F5F5F0] px-4 py-3 rounded-xl mb-4 text-sm outline-none" 
              placeholder="貼上 Gemini API Key..."
              onChange={(e) => {
                setApiKey(e.target.value);
                localStorage.setItem('TCB_API_KEY', e.target.value);
              }}
            />
            <button onClick={() => setShowKeyDialog(false)} className="w-full bg-[#00695C] text-white py-3.5 rounded-xl font-bold">進入系統</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md px-5 py-4 border-b border-[#E5E5E0] flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#00695C] rounded-lg flex items-center justify-center text-white font-bold text-sm">合</div>
          <div>
            <h1 className="font-bold text-[#4A4A4A] text-sm leading-none">政策性貸款助手</h1>
            <p className="text-[9px] text-gray-400 mt-1">114.12 Version</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {pwaStatus !== 'installed' && (
            <button 
              onClick={handleInstall} 
              className={`text-[10px] px-3 py-1.5 rounded-full font-bold transition-colors ${pwaStatus === 'ready' ? 'bg-[#00695C] text-white' : 'bg-gray-100 text-gray-400'}`}
            >
              {pwaStatus === 'ready' ? '安裝 App' : '檢測中...'}
            </button>
          )}
          <button onClick={() => fileInputRef.current.click()} className="p-2 bg-[#F1F1EB] rounded-full text-[#00695C]">
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
               AI 正在思考...
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
            placeholder={knowledgeBase ? "請輸入問題..." : "⚠️ 請先上傳規章"}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading || !knowledgeBase}
            className={`px-5 rounded-xl font-bold transition-all ${!input.trim() || isLoading || !knowledgeBase ? 'bg-gray-100 text-gray-300' : 'bg-[#00695C] text-white'}`}
          >
            發送
          </button>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
