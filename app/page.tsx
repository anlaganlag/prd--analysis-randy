'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Send, Bot, User, Trash2, FileText, Download,
  Settings, Zap, AlertCircle, Loader2, Sparkles,
  ChevronRight, PanelLeftClose, PanelLeftOpen,
  HelpCircle, ListChecks, CheckCircle2, Circle, GraduationCap, Network
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

type WorkflowStep = 'capture' | 'interview' | 'gap' | 'prd' | 'impact' | 'stories'

export default function AIBAProject() {
  // --- State ---
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState('Senior PM')
  const [companyContext, setCompanyContext] = useState('')
  const [currentPrd, setCurrentPrd] = useState('')
  const [currentStories, setCurrentStories] = useState('')
  const [currentAnalysis, setCurrentAnalysis] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('capture')
  const [projects, setProjects] = useState<any[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const scrollRef = useRef<HTMLDivElement>(null)

  // --- Effects ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setProjects(data)
  }

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
    if (mode === 'impact') setWorkflowStep('impact')
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
        } else if (mode === 'impact') {
          setCurrentAnalysis(assistantContent)
        } else if (assistantContent.includes('## 1.') || assistantContent.includes('Objective')) {
          setCurrentPrd(assistantContent)
          if (workflowStep !== 'prd' && workflowStep !== 'stories' && workflowStep !== 'impact') setWorkflowStep('prd')
        }
      }

      // Save to Supabase (Optional)
      await supabase.from('chats').insert(
        newMessages.concat({ role: 'assistant', content: assistantContent }).map(m => ({
          role: m.role,
          content: m.content
        }))
      )

      // Auto-save after successful stream
      if (assistantContent.includes('##') || mode === 'stories' || mode === 'impact') {
        saveProject()
      }

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
    setCurrentAnalysis('')
    setWorkflowStep('capture')
    setCurrentProjectId(null)
  }

  const loadProject = (project: any) => {
    setCurrentProjectId(project.id)
    setCurrentPrd(project.full_prd || '')
    setCurrentStories(project.user_stories || '')
    setCurrentAnalysis(project.impact_analysis || '')
    setMessages([
      { role: 'user', content: `Loading project: ${project.title}` },
      { role: 'assistant', content: `Loaded "${project.title}". You can continue refining the PRD, generating stories, or analyzing impacts.` }
    ])
    setWorkflowStep('prd')
  }

  const saveProject = async () => {
    const title = messages.find(m => m.role === 'user')?.content.slice(0, 50) || 'Untitled Project'
    const projectData = {
      title,
      full_prd: currentPrd,
      user_stories: currentStories,
      impact_analysis: currentAnalysis,
      updated_at: new Date().toISOString()
    }

    if (currentProjectId) {
      await supabase.from('projects').update(projectData).eq('id', currentProjectId)
    } else {
      const { data, error } = await supabase.from('projects').insert([projectData]).select()
      if (!error && data) setCurrentProjectId(data[0].id)
    }
    fetchProjects()
  }

  const steps = [
    { id: 'capture', label: 'Capture', icon: <Sparkles size={14} /> },
    { id: 'interview', label: 'Interview', icon: <HelpCircle size={14} /> },
    { id: 'gap', label: 'Gap Analysis', icon: <AlertCircle size={14} /> },
    { id: 'prd', label: 'PRD', icon: <FileText size={14} /> },
    { id: 'impact', label: 'Impact', icon: <Network size={14} /> },
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
                <option>Customs Brokerage Lead</option>
                <option>Logistics Product Manager</option>
                <option>Supply Chain Analyst</option>
                <option>Operations Director</option>
              </select>
            </section>

            <section>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Company Context</label>
              <textarea
                value={companyContext}
                onChange={(e) => setCompanyContext(e.target.value)}
                placeholder="e.g. UPS Customs Brokerage, Cross-border eCommerce..."
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
                  <>
                    <button
                      onClick={() => handleChat(undefined, "Perform a deep-dive System Impact and Dependency Analysis on this PRD.", "impact")}
                      className="w-full flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 p-2 rounded-lg transition-colors border border-purple-500/20"
                    >
                      <Network className="w-4 h-4 text-purple-400" />
                      Impact Analysis
                    </button>
                    <button
                      onClick={() => handleChat(undefined, "Now decompose this PRD into detailed User Stories with GIVEN/WHEN/THEN AC.", "stories")}
                      className="w-full flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 p-2 rounded-lg transition-colors border border-indigo-500/20"
                    >
                      <ListChecks className="w-4 h-4 text-indigo-400" />
                      Decompose Stories
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="pt-4 border-t border-white/5">
              <button
                onClick={clearChat}
                className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500 hover:text-rose-400 transition-colors mb-4"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Workspace
              </button>

              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">History</label>
              <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadProject(p)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg text-[11px] transition-all border group relative",
                      currentProjectId === p.id
                        ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                        : "bg-white/5 border-transparent text-slate-400 hover:bg-white/10"
                    )}
                  >
                    <div className="truncate pr-4 font-medium">{p.title}</div>
                    <div className="text-[9px] text-slate-600 mt-0.5">
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
                {projects.length === 0 && (
                  <div className="text-[10px] text-slate-600 italic py-2">No saved projects yet.</div>
                )}
              </div>
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
                  <h2 className="text-xl font-bold mb-2">Logistics Requirement Intake</h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Describe your project or feature feature title to begin. I{"'"}ll act as your senior Business Analyst to refine the vision.
                  </p>
                  <div className="mt-8 grid grid-cols-2 gap-2 w-full">
                    <button onClick={() => setInput("Automate customs hold missing document collection for clearing delays")} className="bg-white/5 border border-white/5 p-2 rounded-lg text-[10px] hover:bg-white/10 text-slate-400 transition-all cursor-pointer">{"\""}Automate customs hold doc collection{"\""}</button>
                    <button onClick={() => setInput("Implement real-time shipment status visibility for broker dashboard")} className="bg-white/5 border border-white/5 p-2 rounded-lg text-[10px] hover:bg-white/10 text-slate-400 transition-all cursor-pointer">{"\""}Real-time broker dashboard{"\""}</button>
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
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleChat()
                    }
                  }}
                  placeholder="Describe your feature... (Shift+Enter to new line)"
                  rows={1}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 pl-5 pr-12 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-slate-700 text-sm resize-none overflow-hidden"
                  style={{ minHeight: '52px', maxHeight: '160px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 160) + 'px'
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
              <div className="text-center mt-1.5 text-[9px] text-slate-600">Enter to send · Shift+Enter for new line</div>
            </div>
          </section>

          {/* --- RIGHT: Live Artifact Panel --- */}
          <section className="flex-1 flex flex-col bg-[#0d0d0f] min-w-0">
            <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0 px-6">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-xs tracking-wide">LIVE ARTIFACTS</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveProject}
                  className="flex items-center gap-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-[10px] px-2.5 py-1.5 rounded-lg border border-indigo-600/20 transition-all text-indigo-400"
                >
                  <Download className="w-3.5 h-3.5" /> Save Project
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentPrd || '')
                    showToast('✅ PRD copied to clipboard!')
                  }}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-[10px] px-2.5 py-1.5 rounded-lg border border-white/10 transition-all text-slate-400 hover:text-white"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Copy PRD
                </button>
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
              {!currentPrd && !currentStories && !currentAnalysis ? (
                <div className="h-full flex flex-col items-center justify-center p-8">
                  <div className="max-w-md w-full border border-white/5 rounded-2xl bg-white/[0.02] p-6 shadow-2xl">
                    <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest border-b border-white/5 pb-3">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      Live Artifact Output Structure
                    </h3>
                    <div className="space-y-3">
                      {[
                        "1. Feature Title", "2. Business Problem", "3. Value Statement",
                        "4. Success Metrics", "5. Scope Definition", "6. Functional Behavior",
                        "7. Acceptance Criteria", "8. Non-Functional Req", "9. Dependencies",
                        "10. Breakdown Guidance", "11. Risks & Assumptions"
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-xs text-slate-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700/50"></div>
                          {item}
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/5 text-[10px] text-slate-500 bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <p>Start chatting on the left to generate content. The structured PRD will dynamically appear here.</p>
                    </div>
                  </div>
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
                  {currentPrd && (currentStories || currentAnalysis) && <div className="h-px bg-white/5 my-12 shadow-[0_0_15px_rgba(79,70,229,0.1)]"></div>}

                  {/* Impact Analysis Section */}
                  {currentAnalysis && (
                    <section>
                      <div className="flex items-center gap-2 mb-6 text-purple-400 bg-purple-500/5 p-3 rounded-xl border border-purple-500/10 w-fit">
                        <Network size={18} />
                        <h2 className="text-sm font-bold uppercase tracking-widest m-0">Impact & Dependency Analysis</h2>
                      </div>
                      <article className="prose prose-invert prose-indigo prose-sm max-w-none">
                        <ReactMarkdown>{currentAnalysis}</ReactMarkdown>
                      </article>
                    </section>
                  )}

                  {/* Spacer if both are present */}
                  {currentAnalysis && currentStories && <div className="h-px bg-white/5 my-12 shadow-[0_0_15px_rgba(79,70,229,0.1)]"></div>}

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

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-medium px-5 py-2.5 rounded-full shadow-lg shadow-emerald-500/20 z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
