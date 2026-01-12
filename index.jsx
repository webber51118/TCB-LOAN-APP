
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- System Configuration ---
const TCB_SYSTEM_PROMPT = `你是合庫貸款專家，僅根據 114.12 版規章回答。回答需包含章節引用。請以專業、親切且簡潔的口吻回答。`;

// --- Components ---
const MarkdownRenderer = ({ content }) => (
  <div className="prose prose-sm max-w-none text-[#4A4A4A] leading-relaxed muji-markdown">
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div className="overflow-x-auto my-4 border border-[#E5E5E0] rounded-sm">
            <table className="min-w-full divide-y divide-[#E5E5E0] bg-white">{children}</table>
          </div>
        ),
        h3: ({ children }) => <h3 className="text-base font-semibold text-[#00695C] mt-6 mb-2 border-l-2 border-[#00695C] pl-3">{children}</h3>,
        p: ({ children }) => <p className="mb-3">{children}</p>,
        li: ({ children }) => <li className="mb-1">{children}</li>
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
    content: '您好，我是合庫貸款助手。請先上傳 **114.12 版規章 (.docx)** 檔案，我將為您提供精準的諮詢服務。', 
    timestamp: new Date() 
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // 監聽 PWA 安裝事件
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  // 自動捲動到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      alert("僅支援 .docx 格式");
      return;
    }
    setIsLoading(true);
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setKnowledgeBase(result.value);
      setMessages(prev => [...prev, { id: 'upload-success', role: 'assistant', content: '✅ 規章已成功載入！現在您可以詢問關於青年創業、就學貸款或購屋貸款的問題。', timestamp: new Date() }]);
    } catch (err) {
      alert("讀取失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey || !knowledgeBase) return;
    const userMsg = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...messages.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })), { role: 'user', parts: [{ text: input }] }],
        config: { systemInstruction: TCB_SYSTEM_PROMPT + "\n以下是 114.12 規章內容：\n" + knowledgeBase }
      });
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: response.text, timestamp: new Date() }]);
    } catch (err) {
      alert("連線失敗，請檢查 API Key 或網路狀況。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F9F9F4] safe-top safe-bottom overflow-hidden">
      {/* Key Dialog */}
      {showKeyDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-[#00695C] rounded-2xl flex items-center justify-center mb-4 text-white font-bold text-xl">合</div>
            <h2 className="text-xl font-bold mb-2 text-[#4A4A4A]">設定 AI 金鑰</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">請輸入您的 Gemini API Key。此金鑰僅存於您的手機，安全性極高。</p>
            <input 
              type="password" 
              className="w-full bg-[#F5F5F0] border-none p-4 rounded-xl mb-4 focus:ring-2 focus:ring-[#00695C] outline-none" 
              placeholder="貼上 API Key..."
              onChange={(e) => {
                const val = e.target.value;
                setApiKey(val);
                localStorage.setItem('TCB_API_KEY', val);
              }}
            />
            <button onClick={() => setShowKeyDialog(false)} className="w-full bg-[#00695C] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#00695C]/20 active:scale-95 transition-all">開始諮詢</button>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="block text-center mt-4 text-xs text-[#00695C] underline">如何取得免費金鑰？</a>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-[#E5E5E0] flex justify-between items-center z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#00695C] rounded-lg flex items-center justify-center text-white font-bold text-sm">合</div>
          <span className="font-bold text-[#4A4A4A] tracking-tight">貸款智能助手</span>
        </div>
        <div className="flex items-center space-x-2">
          {deferredPrompt && (
            <button onClick={handleInstallClick} className="text-[10px] bg-[#00695C] text-white px-3 py-1.5 rounded-full font-bold animate-bounce">安裝 APP</button>
          )}
          <button onClick={() => fileInputRef.current.click()} className="p-2 bg-[#F1F1EB] rounded-full text-[#7F8C8D] active:bg-[#E5E5E0]">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx" className="hidden" />
        </div>
      </header>

      {/* Chat Space */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`p-4 rounded-2xl max-w-[88%] ${m.role === 'user' ? 'bg-[#E0E0D8] text-[#4A4A4A] rounded-tr-none' : 'bg-white shadow-sm border border-[#E5E5E0] rounded-tl-none'}`}>
              <MarkdownRenderer content={m.content} />
              <div className="text-[9px] mt-2 opacity-30 text-right">{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-[#E5E5E0] shadow-sm animate-pulse flex space-x-2">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </main>

      {/* Input Bar */}
      <footer className="p-4 bg-white border-t border-[#E5E5E0] safe-bottom">
        <div className="flex space-x-2 max-w-4xl mx-auto">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)}
            disabled={!knowledgeBase}
            className="flex-1 bg-[#F5F5F0] px-4 py-3 rounded-xl outline-none text-sm placeholder:text-gray-400" 
            placeholder={knowledgeBase ? "輸入規章問題..." : "請先點擊上方按鈕上傳規章"}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading || !knowledgeBase}
            className={`px-5 rounded-xl font-bold transition-all ${!input.trim() || isLoading || !knowledgeBase ? 'bg-gray-100 text-gray-300' : 'bg-[#00695C] text-white shadow-md active:scale-95'}`}
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
