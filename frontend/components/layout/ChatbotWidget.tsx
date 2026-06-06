"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User } from "lucide-react";
import { suggestedQuestions } from "@/lib/mockData";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: Date;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "bot",
      text: "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : inputValue.trim();
    if (!textToSend || loading) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const token = localStorage.getItem("financeai_token") || localStorage.getItem("token") || "";
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/ai/ask`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ question: newUserMessage.text, data_source: "financial_transactions" })
      });
      
      if (!response.ok) throw new Error("API error");
      const data = await response.json();
      
      const botResponse: Message = {
        id: Date.now().toString(),
        sender: "bot",
        text: data.answer || "Xin lỗi, đã xảy ra lỗi.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error(error);
      const botResponse: Message = {
        id: Date.now().toString(),
        sender: "bot",
        text: "Không thể kết nối đến máy chủ AI.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botResponse]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col transition-all duration-300 transform origin-bottom-right" style={{ height: "500px", maxHeight: "calc(100vh - 120px)" }}>
          {/* Header */}
          <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="bg-white/20 p-1.5 rounded-full">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Trợ lý ảo FinHub</h3>
                <p className="text-xs text-blue-200">Luôn sẵn sàng hỗ trợ</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-blue-100 hover:text-white hover:bg-blue-700 p-1.5 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[80%] ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex-shrink-0 mt-auto mb-1 ${msg.sender === "user" ? "ml-2" : "mr-2"}`}>
                    {msg.sender === "bot" ? (
                      <div className="bg-blue-100 p-1.5 rounded-full">
                        <Bot size={14} className="text-blue-600" />
                      </div>
                    ) : (
                      <div className="bg-slate-200 p-1.5 rounded-full">
                        <User size={14} className="text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div 
                    className={`p-3 rounded-2xl text-sm ${
                      msg.sender === "user" 
                        ? "bg-blue-600 text-white rounded-br-none" 
                        : "bg-white border border-slate-100 text-slate-800 rounded-bl-none shadow-sm"
                    }`}
                  >
                    {msg.sender === "user" ? (
                      msg.text
                    ) : (
                      <div className="space-y-1">
                        {msg.text.split("\n").map((line, i) => {
                          const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
                          return <p key={i} className="leading-relaxed m-0" dangerouslySetInnerHTML={{ __html: bold || "&nbsp;" }} />;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {messages.length > 0 && messages[messages.length - 1].sender === "bot" && !loading && (
              <div className="flex flex-col space-y-2 mt-2 ml-8 max-w-[80%]">
                <p className="text-xs text-slate-500 mb-1">Gợi ý cho bạn:</p>
                {suggestedQuestions.slice(0, 3).map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="text-left text-xs bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 py-2 px-3 rounded-xl transition-colors shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            
            {loading && (
              <div className="flex justify-start">
                <div className="flex flex-row max-w-[80%]">
                  <div className="flex-shrink-0 mt-auto mb-1 mr-2">
                    <div className="bg-blue-100 p-1.5 rounded-full">
                      <Bot size={14} className="text-blue-600" />
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl text-sm bg-white border border-slate-100 text-slate-800 rounded-bl-none shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full pr-1 pl-4 py-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
              <input 
                type="text" 
                placeholder="Nhập tin nhắn..." 
                className="flex-1 bg-transparent text-sm outline-none text-slate-700 py-2"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button 
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors flex-shrink-0 ml-2"
              >
                <Send size={16} className={inputValue.trim() ? "ml-0.5" : ""} />
              </button>
            </div>
            <div className="text-center mt-2">
              <span className="text-[10px] text-slate-400">Được hỗ trợ bởi AI - Câu trả lời có thể không chính xác 100%</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${isOpen ? 'bg-slate-800 hover:bg-slate-900' : 'bg-blue-600 hover:bg-blue-700'} text-white p-4 rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-center relative group`}
        aria-label="Chat with AI Assistant"
      >
        {/* Radar Ping Animation */}
        {!isOpen && (
          <>
            <span className="absolute w-full h-full rounded-full bg-blue-500 opacity-20 animate-ping" style={{ animationDuration: '3s' }}></span>
            <span className="absolute w-full h-full rounded-full bg-blue-500 opacity-20 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }}></span>
          </>
        )}
        
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        
        {/* Tooltip */}
        {!isOpen && (
          <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs font-medium py-1 px-2.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Trò chuyện với AI
          </span>
        )}
      </button>
    </div>
  );
}
