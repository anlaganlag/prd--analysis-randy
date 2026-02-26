'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Send, Bot, User, Trash2, FileText, Download,
  Settings, Zap, AlertCircle, Loader2, Sparkles,
  ChevronRight, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AIBAProject() {
  // --- State ---
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState('Senior PM')
  const [companyContext, setCompanyContext] = useState('')
  const [currentPrd, setCurrentPrd] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'doc'>('chat')

  const scrollRef = useRef<HTMLDivElement>(null)

  // --- Effects ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // --- Actions ---
  const handleChat = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault()
    const prompt = customPrompt || input
    if (!prompt.trim() || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: prompt }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          userRole,
          companyContext
        })
      })

      if (!response.ok) throw new Error('API Error')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      let assistantContent = ''
      setMessages([...newMessages, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = new TextDecoder().decode(value)
        assistantContent += text
        setMessages([...newMessages, { role: 'assistant', content: assistantContent }])

        // Auto-detect PRD content
        if (assistantContent.includes('##') && (assistantContent.includes('Objective') || assistantContent.includes('Requirement'))) {
          setCurrentPrd(assistantContent)
        }
      }

      // Save to Supabase (Optional)
      await supabase.from('chats').insert(
        newMessages.concat({ role: 'assistant', content: assistantContent }).map(m => ({
          role: m.role,
          content: m.content
        }))
      )

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const downloadDocx = async () => {
    const res = await fetch('/api/export-docx', {
      method: 'POST',
      body: JSON.stringify({ content: currentPrd, title: 'AI_BA_PRD' })
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'AI_BA_PRD.docx'
    a.click()
  }

  const clearChat = () => {
    setMessages([])
    setCurrentPrd('')
  }

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-slate-200 overflow-hidden font-sans">

      {/* --- Sidebar --- */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 320 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="border-r border-white/5 bg-[#0f0f11] flex-shrink-0 overflow-hidden relative"
      >
        <div className="p-6 w-[320px]">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">
              AI BA Pro
            </h1>
          </div>

          <div className="space-y-8">
            <section>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Perspective</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              >
                <option>Senior PM</option>
                <option>Tech Lead</option>
                <option>Startup Founder</option>
                <option>Business Analyst</option>
              </select>
            </section>

            <section>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Company Context</label>
              <textarea
                value={companyContext}
                onChange={(e) => setCompanyContext(e.target.value)}
                placeholder="e.g. B2B Fintech SaaS..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm h-32 resize-none focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </section>

            <section className="pt-4 border-t border-white/5">
              <button
                onClick={clearChat}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear Chat History
              </button>
            </section>
          </div>
        </div>

        {/* Toggle Button Inside Sidebar (Absolute) */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-6 right-4 p-1 hover:bg-white/5 rounded-md text-slate-500"
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </motion.aside>

      {/* --- Main Area --- */}
      <main className="flex-1 flex flex-col relative bg-[#0a0a0b]">

        {/* Top Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0a0a0b]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-md text-slate-500 transition-colors">
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}
            <div className="flex bg-white/5 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('chat')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === 'chat' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Collaboration
              </button>
              <button
                onClick={() => setActiveTab('doc')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === 'doc' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Live Artifact
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleChat(undefined, "Perform a CPO-level gap analysis on the current requirement. Find edge cases and strategic holes.")}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-lg bg-indigo-500/5 transition-all"
            >
              Gap Analysis
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">

          {/* --- Chat View --- */}
          <section className={cn(
            "flex-1 flex flex-col transition-all",
            activeTab === 'chat' ? "opacity-100" : "w-0 opacity-0 invisible"
          )}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                  <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                    <Sparkles className="w-8 h-8 text-indigo-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Ready to Build?</h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Describe your feature idea or drop some rough notes. I'll help you refine the business logic and generate a professional PRD.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-4 max-w-3xl",
                      m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center",
                      m.role === 'assistant' ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-400"
                    )}>
                      {m.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed",
                      m.role === 'assistant'
                        ? "bg-white/5 border border-white/5 text-slate-300"
                        : "bg-indigo-600 text-white shadow-xl shadow-indigo-500/10"
                    )}>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-white/5 bg-[#0a0a0b]">
              <form onSubmit={handleChat} className="max-w-3xl mx-auto relative group">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for a draft or refining questions..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder-slate-600"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </section>

          {/* --- Artifact View --- */}
          <section className={cn(
            "flex-1 flex flex-col bg-[#0d0d0f] transition-all border-l border-white/5",
            activeTab === 'doc' ? "opacity-100" : "w-0 opacity-0 invisible"
          )}>
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <span className="font-semibold text-sm">PRD Draft</span>
              </div>
              {currentPrd && (
                <div className="flex gap-2">
                  <button
                    onClick={downloadDocx}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-xs px-3 py-1.5 rounded-lg border border-white/10 transition-all"
                  >
                    <Download className="w-4 h-4" /> Export .docx
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              {currentPrd ? (
                <article className="max-w-2xl mx-auto prose prose-invert prose-indigo prose-headings:font-bold prose-h2:border-b prose-h2:border-white/5 prose-h2:pb-2">
                  <ReactMarkdown>{currentPrd}</ReactMarkdown>
                </article>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No PRD generated yet.</p>
                  <button
                    onClick={() => handleChat(undefined, "Please generate a comprehensive PRD based on our discussion so far.")}
                    className="mt-4 text-indigo-400 hover:underline text-xs"
                  >
                    Draft one now
                  </button>
                </div>
              )}
            </div>
          </section>

        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>
    </div>
  )
}
