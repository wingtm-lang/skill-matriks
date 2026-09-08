import React, { useState, useRef, useEffect } from 'react';
import { 
  BotMessageSquare, 
  Send, 
  Sparkles, 
  User, 
  Trash2, 
  RefreshCw, 
  HelpCircle,
  Lightbulb,
  Award,
  Layers,
  Cpu,
  TrendingUp,
  Flame
} from 'lucide-react';
import { Operator, GarmentStyle } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface Message {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: string;
}

interface IEChatAssistantTabProps {
  operators: Operator[];
  styles: GarmentStyle[];
  selectedLine: string;
  selectedFactory: string;
}

export const IEChatAssistantTab: React.FC<IEChatAssistantTabProps> = ({
  operators,
  styles,
  selectedLine,
  selectedFactory,
}) => {
  const { t, language } = useLanguage();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      sender: 'AI',
      text: t.ieChat.defaultWelcome,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Update initial message if language changes and chat hasn't been engaged yet
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'msg-init') {
        return [
          {
            id: 'msg-init',
            sender: 'AI',
            text: t.ieChat.defaultWelcome,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
      }
      return prev;
    });
  }, [language, t.ieChat.defaultWelcome]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    t.ieChat.quick1,
    t.ieChat.quick2,
    t.ieChat.quick3,
    t.ieChat.quick4,
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'USER',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          prompt: text,
          language,
          context: {
            selectedLine,
            selectedFactory,
            totalOperators: operators.length,
            activeStyle: styles[0]?.styleName,
            operators: operators.slice(0, 30).map((o) => ({
              nik: o.nik,
              name: o.name,
              grade: o.grade,
              points: o.points,
              lockstitch: o.lockstitch,
              overlock: o.overlock,
              flatseam: o.flatseam,
              special: o.special,
            })),
          },
        }),
      });

      clearTimeout(timeoutId);

      let data: any = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        console.warn('Failed to parse json response:', parseErr);
      }

      const aiReply: Message = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: data.reply || t.ieChat.serverError,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Error sending chat message:', err);
      const isAbort = err?.name === 'AbortError';
      const errorReply: Message = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: isAbort ? t.ieChat.abortError : t.ieChat.serverError,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'AI',
        text: t.ieChat.clearedMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="bg-white border border-[#E0E8E8] rounded-[20px] shadow-[0_8px_30px_rgba(48,72,72,0.06)] flex flex-col h-[750px] overflow-hidden">
      
      {/* CHAT HEADER */}
      <div className="p-4 sm:p-5 border-b border-[#E0E8E8] flex items-center justify-between bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#D9F1EF] border border-[#BDE5E2] flex items-center justify-center text-[#247F77]">
            <BotMessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#304848]">{t.ieChat.specialistTitle}</h3>
              <span className="badge-gold text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E8D499]">
                {t.ieChat.expertBadge}
              </span>
            </div>
            <p className="text-xs text-[#788888]">
              {t.ieChat.specialistSubtitle}
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="p-2 rounded-xl text-[#788888] hover:text-[#C96B6B] hover:bg-[#FDECEC] transition-colors cursor-pointer"
          title={t.ieChat.clearChatTooltip}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* MESSAGES SCROLL AREA */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#F8FBFB]/40">
        {messages.map((msg) => {
          const isUser = msg.sender === 'USER';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-[#D9F1EF] border border-[#BDE5E2] flex items-center justify-center text-[#247F77] shrink-0 mt-1">
                  <BotMessageSquare className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                  isUser
                    ? 'bg-[#405858] text-white rounded-tr-xs'
                    : 'bg-white border border-[#E0E8E8] text-[#304848] rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
                <div
                  className={`text-[10px] mt-2 text-right font-mono ${
                    isUser ? 'text-[#C8D8D8]' : 'text-[#98A8A8]'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-[#405858] border border-[#385050] flex items-center justify-center text-white shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-[#D9F1EF] border border-[#BDE5E2] flex items-center justify-center text-[#247F77] shrink-0 mt-1">
              <BotMessageSquare className="w-4 h-4" />
            </div>
            <div className="bg-white border border-[#E0E8E8] rounded-2xl rounded-tl-xs p-4 shadow-2xs flex items-center gap-2 text-xs text-[#788888]">
              <RefreshCw className="w-4 h-4 animate-spin text-[#D0A018]" />
              <span>{t.ieChat.analyzingProduction}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* QUICK PROMPTS CHIPS */}
      <div className="px-4 py-2.5 bg-white border-t border-[#E0E8E8] flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-[#788888] flex items-center gap-1 shrink-0">
          <Lightbulb className="w-3.5 h-3.5 text-[#D0A018]" />
          {t.ieChat.suggestionsLabel}
        </span>
        {quickPrompts.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            className="shrink-0 text-[11px] bg-[#F8F8F8] hover:bg-[#E0F0F0] text-[#405858] border border-[#E0E8E8] px-3 py-1 rounded-full transition-colors cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* INPUT FORM */}
      <div className="p-4 bg-white border-t border-[#E0E8E8]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={t.ieChat.inputPlaceholder}
            className="flex-1 bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] text-xs sm:text-sm rounded-xl px-4 py-3 focus:border-[#2AAFA3] focus:ring-2 focus:ring-[#2AAFA3]/20 focus:outline-none placeholder:text-[#98A8A8]"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="bg-[#D0A018] hover:bg-[#B88C10] text-white p-3 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-40"
            title={t.ieChat.sendBtn}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};
