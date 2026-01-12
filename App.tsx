
import React, { useState, useRef, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import mammoth from 'mammoth';

const App: React.FC = () => {
  const [knowledgeBase, setKnowledgeBase] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 監聽 PWA 安裝事件
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      console.log('PWA was installed');
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setErrorMsg('格式錯誤：請上傳 .docx 格式。');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setIsParsing(true);
    setFileName(file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      const text = result.value;
      if (!text || text.trim().length === 0) throw new Error('檔案內容為空。');
      setKnowledgeBase(text);
      setErrorMsg(null);
    } catch (error: any) {
      setErrorMsg(`讀取失敗：${error.message}`);
      setFileName(null);
      setKnowledgeBase(undefined);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();
  const handleReset = () => { setKnowledgeBase(undefined); setFileName(null); };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F4] safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E5E0] px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-[#00695C] flex items-center justify-center rounded-md shadow-sm">
             <span className="text-white font-bold text-lg">合</span>
          </div>
          <div>
            <h1 className="text-md font-medium text-[#4A4A4A] leading-tight">政策性貸款</h1>
            <p className="text-[9px] text-[#7F8C8D] tracking-widest uppercase">Smart Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {deferredPrompt && (
            <button 
              onClick={handleInstallClick}
              className="text-[10px] bg-[#00695C] text-white px-3 py-1.5 rounded-full font-medium shadow-sm active:scale-95 transition-all"
            >
              安裝 APP
            </button>
          )}
          {fileName && (
            <button onClick={handleReset} className="text-[10px] bg-[#F1F1EB] px-2 py-1.5 rounded text-[#7F8C8D] active:bg-[#E5E5E0]">
              重置
            </button>
          )}
          <button 
            onClick={triggerFileInput}
            disabled={isParsing}
            className="p-2 border border-[#D1D1CB] rounded-full text-[#4A4A4A] active:bg-[#F1F1EB]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx" className="hidden" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
        <div className="flex-1 bg-white flex flex-col relative md:mt-4 md:rounded-t-2xl md:border md:border-[#E5E5E0] md:shadow-sm">
          {!knowledgeBase && !isParsing && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white p-6 text-center">
              <div className="max-w-xs">
                <div className="w-16 h-16 bg-[#F9F9F4] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#7F8C8D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium mb-2">歡迎使用智能助手</h2>
                <p className="text-xs text-[#7F8C8D] mb-8 leading-relaxed">
                  請點擊右上角上傳合庫 **114.12 版規章輯要** (.docx) 檔案。
                </p>
                {errorMsg && <div className="mb-4 text-xs text-red-500">{errorMsg}</div>}
                <button onClick={triggerFileInput} className="w-full bg-[#00695C] text-white py-3.5 rounded-xl font-medium active:scale-95 transition-all shadow-lg shadow-[#00695C]/20">
                  上傳規章 (.docx)
                </button>
              </div>
            </div>
          )}
          <ChatInterface knowledgeBase={knowledgeBase} />
        </div>
      </main>

      <style>{`
        .safe-top { padding-top: env(safe-area-inset-top); }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        
        /* 當以 Standalone 模式啟動時的微調 */
        @media (display-mode: standalone) {
          header { padding-top: calc(env(safe-area-inset-top) + 1rem); }
        }
      `}</style>
    </div>
  );
};

export default App;
