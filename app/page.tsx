'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Send, Bot, User, Trash2, FileText, Download,
  Settings, Zap, AlertCircle, Loader2, Sparkles,
  ChevronRight, PanelLeftClose, PanelLeftOpen,
  HelpCircle, ListChecks, CheckCircle2, Circle, GraduationCap
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

type WorkflowStep = 'capture' | 'interview' | 'gap' | 'prd' | 'stories'

export default function AIBAProject() {
  // --- State ---
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState('Senior PM')
  const [companyContext, setCompanyContext] = useState('')
  const [currentPrd, setCurrentPrd] = useState('')
  const [currentStories, setCurrentStories] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('capture')

  const scrollRef = useRef<HTMLDivElement>(null)

  // --- Effects ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // --- Actions ---
  const handleChat = async (e?: React.FormEvent, customPrompt?: string, mode: string = 'default') => {
    if (e) e.preventDefault()
    const prompt = customPrompt || input
    if (!prompt.trim() || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: prompt }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Update workflow step based on action
    if (mode === 'interview') setWorkflowStep('interview')
    if (mode === 'default' && (prompt.toLowerCase().includes('draft') || prompt.toLowerCase().includes('generate'))) setWorkflowStep('prd')
    if (mode === 'stories') setWorkflowStep('stories')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          userRole,
          companyContext,
          mode
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

        const updatedAssistantMessage: Message = { role: 'assistant', content: assistantContent }
        setMessages([...newMessages, updatedAssistantMessage])

        // Auto-detect PRD content or User Stories
        if (mode === 'stories') {
          setCurrentStories(assistantContent)
        } else if (assistantContent.includes('## 1.') || assistantContent.includes('Objective')) {
          setCurrentPrd(assistantContent)
          if (workflowStep !== 'prd' && workflowStep !== 'stories') setWorkflowStep('prd')
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

  const downloadDocx = async (content: string, type: string) => {
    const res = await fetch('/api/export-docx', {
      method: 'POST',
      body: JSON.stringify({ content, title: `AI_BA_${type}` })
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AI_BA_${type}.docx`
    a.click()
  }

  const clearChat = () => {
    setMessages([])
    setCurrentPrd('')
    setCurrentStories('')
    setWorkflowStep('capture')
  }

  const steps = [
    { id: 'capture', label: 'Capture', icon: <Sparkles size={14} /> },
    { id: 'interview', label: 'Interview', icon: <HelpCircle size={14} /> },
    { id: 'gap', label: 'Gap Analysis', icon: <AlertCircle size={14} /> },
    { id: 'prd', label: 'PRD', icon: <FileText size={14} /> },
    { id: 'stories', label: 'Stories', icon: <ListChecks size={14} /> },
  ]

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-slate-200 overflow-hidden font-sans">

      {/* --- Sidebar --- */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="border-r border-white/5 bg-[#0f0f11] flex-shrink-0 overflow-hidden relative"
      >
        <div className="p-6 w-[280px]">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">
              AI BA Pro
            </h1>
          </div>

          <div className="space-y-6">
            <section>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Perspective</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              >
                <option>Senior PM</option>
                <option>Tech Lead</option>
                <option>Startup Founder</option>
                <option>Business Analyst</option>
              </select>
            </section>

            <section>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Company Context</label>
              <textarea
                value={companyContext}
                onChange={(e) => setCompanyContext(e.target.value)}
                placeholder="e.g. B2B Fintech SaaS..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs h-24 resize-none focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </section>

            <section className="pt-4 border-t border-white/5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Quick Actions</div>
              <div className="space-y-2">
                <button
                  onClick={() => handleChat(undefined, "Let's start the structured interview phase. Please ask me 5 strategic questions.", "interview")}
                  className="w-full flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors border border-white/5"
                >
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  Start AI Interview
                </button>
                <button
                  onClick={() => handleChat(undefined, "Perform a CPO-level gap analysis on the requirements so far.", "default")}
                  className="w-full flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors border border-white/5"
                >
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Perform Gap Analysis
                </button>
                <button
                  onClick={() => handleChat(undefined, "Draft a full 11-element PRD based on our discussion.", "default")}
                  className="w-full flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors border border-white/5"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Generate Full PRD
                </button>
                {currentPrd && (
                  <button
                    onClick={() => handleChat(undefined, "Now decompose this PRD into detailed User Stories with GIVEN/WHEN/THEN AC.", "stories")}
                    className="w-full flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 p-2 rounded-lg transition-colors border border-indigo-500/20"
                  >
                    <ListChecks className="w-4 h-4 text-indigo-400" />
                    Decompose Stories
                  </button>
                )}
              </div>
            </section>

            <section className="pt-4 border-t border-white/5">
              <button
                onClick={clearChat}
                className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Workspace
              </button>
            </section>
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-6 right-4 p-1 hover:bg-white/5 rounded-md text-slate-500"
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </motion.aside>

      {/* --- Main Area: Split Pane --- */}
      <main className="flex-1 flex flex-col relative bg-[#0a0a0b] min-w-0">

        {/* Top Header: Stepper */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0a0a0b]/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-md text-slate-500 transition-colors shrink-0">
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}

            {/* Stepper Component */}
            <div className="flex items-center gap-1 hidden md:flex min-w-0 overflow-hidden">
              {steps.map((step, idx) => {
                const isActive = workflowStep === step.id
                const isCompleted = steps.findIndex(s => s.id === workflowStep) > idx
                return (
                  <div key={step.id} className="flex items-center gap-1 shrink-0">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border shrink-0",
                      isActive ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" :
                        isCompleted ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                          "bg-white/5 border-white/10 text-slate-500"
                    )}>
                      {isCompleted ? <CheckCircle2 size={12} /> : step.icon}
                      {step.label}
                    </div>
                    {idx < steps.length - 1 && (
                      <ChevronRight size={12} className="text-slate-700 shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-500 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              Deployed to Vercel
            </div>
          </div>
        </header>

        {/* Split View Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* --- LEFT: Collaboration Chat --- */}
          <section className="flex-1 flex flex-col border-r border-white/5 bg-[#0a0a0b] min-w-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto p-4">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                    <Sparkles className="w-7 h-7 text-indigo-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Requirement Intake</h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Describe your project or feature feature title to begin. I{"'"}ll act as your senior Business Analyst to refine the vision.
                  </p>
                  <div className="mt-8 grid grid-cols-2 gap-2 w-full">
                    <button onClick={() => setInput("Build a customer loyalty dashboard for a coffee shop")} className="bg-white/5 border border-white/5 p-2 rounded-lg text-[10px] hover:bg-white/10 text-slate-400 transition-all">{"\""}Customer loyalty dashboard{"\""}</button>
                    <button onClick={() => setInput("Implement real-time shipment status visibility")} className="bg-white/5 border border-white/5 p-2 rounded-lg text-[10px] hover:bg-white/10 text-slate-400 transition-all">{"\""}Real-time shipment status{"\""}</button>
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3 max-w-2xl px-2",
                      m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-1",
                      m.role === 'assistant' ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-400"
                    )}>
                      {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                    </div>
                    <div className={cn(
                      "p-3.5 rounded-2xl text-[13px] leading-relaxed",
                      m.role === 'assistant'
                        ? "bg-white/5 border border-white/5 text-slate-300"
                        : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/10"
                    )}>
                      <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 text-inherit">
                        <ReactMarkdown>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/5 bg-[#0a0a0b]">
              <form onSubmit={handleChat} className="max-w-2xl mx-auto relative group">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your feature..."
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 pl-5 pr-12 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-slate-700 text-sm"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </section>

          {/* --- RIGHT: Live Artifact Panel --- */}
          <section className="flex-1 flex flex-col bg-[#0d0d0f] min-w-0">
            <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0 px-6">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-xs tracking-wide">LIVE ARTIFACTS</span>
              </div>
              <div className="flex gap-2">
                {currentPrd && (
                  <button
                    onClick={() => downloadDocx(currentPrd, 'PRD')}
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-[10px] px-2.5 py-1.5 rounded-lg border border-white/10 transition-all text-slate-400 hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5" /> Export PRD
                  </button>
                )}
                {currentStories && (
                  <button
                    onClick={() => downloadDocx(currentStories, 'Stories')}
                    className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] px-2.5 py-1.5 rounded-lg border border-indigo-500/20 transition-all text-indigo-400"
                  >
                    <ListChecks className="w-3.5 h-3.5" /> Export Stories
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar h-full">
              {!currentPrd && !currentStories ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-700">
                  <FileText className="w-10 h-10 mb-4 opacity-5" />
                  <p className="text-[11px] uppercase tracking-widest font-bold">Waiting for input...</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-12 pb-20">
                  {/* PRD Section */}
                  {currentPrd && (
                    <article className="prose prose-invert prose-indigo prose-sm max-w-none 
                      prose-h2:text-lg prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-white/5 prose-h2:pb-2
                      prose-h3:text-sm prose-h3:text-indigo-400 prose-h3:uppercase prose-h3:tracking-widest
                      prose-p:text-slate-400 prose-li:text-slate-400
                      prose-table:border prose-table:border-white/5 prose-th:bg-white/5 prose-td:border-t prose-td:border-white/5">
                      <ReactMarkdown>{currentPrd}</ReactMarkdown>
                    </article>
                  )}

                  {/* Stories Section separator */}
                  {currentPrd && currentStories && <div className="h-px bg-white/5 my-12 shadow-[0_0_15px_rgba(79,70,229,0.1)]"></div>}

                  {/* User Stories Section */}
                  {currentStories && (
                    <section>
                      <div className="flex items-center gap-2 mb-6 text-indigo-400 bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10 w-fit">
                        <GraduationCap size={18} />
                        <h2 className="text-sm font-bold uppercase tracking-widest m-0">Generated User Stories</h2>
                      </div>
                      <article className="prose prose-invert prose-indigo prose-sm max-w-none">
                        <ReactMarkdown>{currentStories}</ReactMarkdown>
                      </article>
                    </section>
                  )}
                </div>
              )}
            </div>
          </section>

        </div>
      </main>

    </div>
  )
}
