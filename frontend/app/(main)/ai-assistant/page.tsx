"use client";
import { useState, useRef, useEffect } from "react";
import Header from "@/components/layout/Header";
import { suggestedQuestions, aiMessages } from "@/lib/mockData";
import { Send, Bot, User, Sparkles, AlertCircle } from "lucide-react";

type Message = { role: string; text: string; time: string };

function formatTime() {
  return new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});
}

function MarkdownText({ text }: { text:string }) {
  // Simple bold + newline renderer
  const parts = text.split("\n");
  return (
    <div className="space-y-1">
      {parts.map((line,i)=>{
        const bold = line.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");
        return <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{__html:bold||"&nbsp;"}}/>;
      })}
    </div>
  );
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>(aiMessages);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role:"user", text, time:formatTime() };
    setMessages(m=>[...m, userMsg]);
    setInput(""); setLoading(true);
    
    try {
      const token = localStorage.getItem("financeai_token") || localStorage.getItem("token") || "";
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/ai/ask`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ question: text, data_source: "financial_transactions" })
      });
      if (!response.ok) throw new Error("API error");
      const data = await response.json();
      
      const reply: Message = {
        role: "assistant",
        time: formatTime(),
        text: data.answer || "Xin lỗi, đã xảy ra lỗi.",
      };
      setMessages(m=>[...m,reply]);
    } catch (error) {
      console.error(error);
      const reply: Message = {
        role: "assistant",
        time: formatTime(),
        text: "Không thể kết nối đến máy chủ AI.",
      };
      setMessages(m=>[...m,reply]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="AI Assistant" />
      <div className="flex flex-1 overflow-hidden p-6 gap-6">

        {/* Sidebar: suggested questions */}
        <div className="w-72 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-500"/>
              <h3 className="font-semibold text-slate-700 text-sm">Suggested Questions</h3>
            </div>
            <div className="space-y-2">
              {suggestedQuestions.map((q,i)=>(
                <button key={i} onClick={()=>send(q)}
                  className="w-full text-left text-xs text-slate-600 p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-200 transition-all leading-relaxed">
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-amber-700 leading-relaxed">
                Câu trả lời do AI hỗ trợ, cần kiểm tra lại trước khi sử dụng chính thức.
              </p>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m,i)=>(
              <div key={i} className={`flex gap-3 ${m.role==="user"?"flex-row-reverse":""}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role==="user"?"bg-blue-600":"bg-gradient-to-br from-violet-500 to-purple-600"
                }`}>
                  {m.role==="user"
                    ? <User className="w-4 h-4 text-white"/>
                    : <Bot  className="w-4 h-4 text-white"/>}
                </div>
                {/* Bubble */}
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  m.role==="user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-slate-50 border border-slate-200 rounded-tl-sm"
                }`}>
                  {m.role==="user"
                    ? <p className="text-sm">{m.text}</p>
                    : <MarkdownText text={m.text}/>}
                  <p className={`text-xs mt-1.5 ${m.role==="user"?"text-blue-200":"text-slate-400"}`}>{m.time}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white"/>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    {[0,1,2].map(i=>(
                      <span key={i} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-4">
            <form onSubmit={e=>{e.preventDefault();send(input);}}
              className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e=>setInput(e.target.value)}
                placeholder="Ask about financial data…"
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button type="submit" disabled={!input.trim()||loading}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center transition-colors">
                <Send className="w-4 h-4"/>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
