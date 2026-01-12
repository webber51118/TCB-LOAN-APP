
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- System Configuration ---
const TCB_SYSTEM_PROMPT = `你是合庫貸款專家，僅根據 114.12 版規章回答。回答需包含章節引用。`;

// --- Components ---
const MarkdownRenderer = ({ content }) => (
  <div className="prose prose-sm max-w-none text-[#4A4A4A] leading-relaxed">
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => <div className="overflow-x-auto my-4 border rounded"><table className="min-w-full divide-y">{children}</table></div>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-6 mb-2 border-l-2 border-[#00695C] pl-3">{children}</h3>
      }}
    >{content}</ReactMarkdown>
  </div>
);

const App = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('TCB_API_KEY') || '');
  const [showKeyDialog, setShowKeyDialog] = useState(!apiKey);
  const [knowledgeBase, setKnowledgeBase] = useState(null);
  const [messages, setMessages] = useState([{ id: '1', role: 'assistant', content: '您好，請上傳規章後開始諮詢。', timestamp: new Date() }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    setKnowledgeBase(result.value);
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;
    const userMsg = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })), { role: 'user', parts: [{ text: input }] }],
        config: { systemInstruction: TCB_SYSTEM_PROMPT + "\n規章內容：" + (knowledgeBase || "") }
      });
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: response.text, timestamp: new Date() }]);
    } catch (err) {
      alert("API 錯誤，請檢查 Key 是否正確");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F4] safe-top">
      {/* Key Dialog */}
      {showKeyDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h2 className="font-bold mb-4">設定 Gemini API 金鑰</h2>
            <p className="text-xs text-gray-500 mb-4">金鑰僅存於您的手機，不會上傳 GitHub。</p>
            <input 
              type="password" 
              className="w-full border p-3 rounded-lg mb-4" 
              placeholder="貼上 API Key..."
              onChange={(e) => {
                const val = e.target.value;
                setApiKey(val);
                localStorage.setItem('TCB_API_KEY', val);
              }}
            />
            <button onClick={() => setShowKeyDialog(false)} className="w-full bg-[#00695C] text-white py-3 rounded-xl">開始使用</button>
          </div>
        </div>
      )}

      <header className="bg-white p-4 border-b flex justify-between items-center sticky top-0">
        <span className="font-bold text-[#00695C]">合庫貸款助手</span>
        <button onClick={() => fileInputRef.current.click()} className="text-xs border p-2 rounded">上傳規章</button>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-4 rounded-xl max-w-[85%] ${m.role === 'user' ? 'bg-[#F1F1EB]' : 'bg-white shadow-sm'}`}>
              <MarkdownRenderer content={m.content} />
            </div>
          </div>
        ))}
      </main>

      <footer className="p-4 bg-white border-t safe-bottom">
        <div className="flex space-x-2 max-w-4xl mx-auto">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)}
            className="flex-1 bg-[#F9F9F4] p-3 rounded-lg outline-none" 
            placeholder="請輸入問題..."
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button onClick={handleSend} className="bg-[#00695C] text-white p-3 rounded-lg">發送</button>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
