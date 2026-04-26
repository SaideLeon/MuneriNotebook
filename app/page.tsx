'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MoreVertical, 
  Search, 
  SquareChevronRight, 
  X, 
  Send, 
  Mic2, 
  Presentation, 
  FileText, 
  Map as MapIcon, 
  LayoutList, 
  Copy, 
  GraduationCap, 
  BarChart3, 
  TableProperties,
  Check,
  ChevronRight,
  Menu,
  FileBox,
  Settings,
  Share2,
  Clock,
  History
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

import { useThemeMode } from '@/hooks/useThemeMode';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: number[];
}

interface Source {
  id: string;
  name: string;
  type: 'pdf' | 'text' | 'link';
  data?: string; // base64 for PDF
  selected: boolean;
}

interface Notebook {
  id: string;
  title: string;
  icon: string;
  sources: Source[];
  lastModified: string;
  description: string;
}

interface ActivityItem {
  id: string;
  type: 'notebook_opened' | 'source_added' | 'document_summarized' | 'semantic_search' | 'message_sent';
  title: string;
  timestamp: Date;
  metadata?: string;
}

const INITIAL_NOTEBOOKS: Notebook[] = [
  {
    id: 'bio-1',
    title: 'Fundamentos de Biologia Celular e Molecular',
    icon: '🧬',
    sources: [
      { id: 's1', name: 'Biologia_Celular.pdf', type: 'pdf', selected: true }
    ],
    lastModified: '19 de abr. de 2026',
    description: 'Estudo das estruturas celulares e processos moleculares.'
  },
  {
    id: 'mkt-1',
    title: 'Marketing Digital da Recheio Cash & Carry em Moçambique',
    icon: '🛒',
    sources: [
      { id: 's2', name: 'Trabalho_Redes_Sociais.pdf', type: 'pdf', selected: true }
    ],
    lastModified: '26 de abr. de 2026',
    description: 'Análise estratégica do uso de redes sociais pela Recheio Moçambique.'
  },
  {
    id: 'form-1',
    title: 'Manual de Concepção e Gestão da Formação',
    icon: '🎓',
    sources: [
      { id: 's3', name: 'Manual_Gestao.pdf', type: 'pdf', selected: true },
      { id: 's4', name: 'Curriculo_V1.pdf', type: 'pdf', selected: true }
    ],
    lastModified: '18 de abr. de 2026',
    description: 'Guia completo para desenvolvimento de programas de formação.'
  }
];

export default function MuneriNotebooks() {
  const { themeMode, toggleThemeMode, mounted } = useThemeMode();
  const [notebooks, setNotebooks] = useState<Notebook[]>(INITIAL_NOTEBOOKS);
  const [view, setView] = useState<'home' | 'notebook'>('home');
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [addSourceTab, setAddSourceTab] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const logActivity = (type: ActivityItem['type'], title: string, metadata?: string) => {
    const newItem: ActivityItem = {
      id: crypto.randomUUID(),
      type,
      title,
      timestamp: new Date(),
      metadata
    };
    setRecentActivity(prev => [newItem, ...prev].slice(0, 20)); // Keep last 20
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopyAll = () => {
    if (messages.length === 0) return;
    
    const formattedText = messages.map(msg => {
      const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
      return `${role}:\n${msg.content}\n\n`;
    }).join('---\n\n');
    
    navigator.clipboard.writeText(formattedText);
  };

  const handleCitationClick = (citeId: number) => {
    const activeSources = sources.filter(s => s.selected || s.data);
    const source = activeSources[citeId - 1];
    if (source) {
      setHighlightedSourceId(source.id);
      // Auto-scroll to source
      document.getElementById(`source-${source.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => setHighlightedSourceId(null), 3000);
    }
  };

  const handleOpenNotebook = (nb: Notebook) => {
    setSelectedNotebook(nb);
    setTempTitle(nb.title);
    setSources(nb.sources);
    setView('notebook');
    setMessages([]); // Start fresh or load from local storage
    logActivity('notebook_opened', nb.title);
  };

  const handleUpdateTitle = () => {
    if (!tempTitle.trim() || !selectedNotebook) return;
    
    const updatedNotebook = { ...selectedNotebook, title: tempTitle };
    setSelectedNotebook(updatedNotebook);
    setNotebooks(prev => prev.map(nb => nb.id === selectedNotebook.id ? updatedNotebook : nb));
    setIsEditingTitle(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const newSource: Source = {
        id: crypto.randomUUID(),
        name: file.name,
        type: 'pdf',
        data: base64,
        selected: true
      };
      setSources(prev => [...prev, newSource]);
      logActivity('source_added', file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleAddTextSource = () => {
    if (!pastedText.trim() || !pastedTitle.trim()) return;

    const newSource: Source = {
      id: crypto.randomUUID(),
      name: pastedTitle.endsWith('.txt') ? pastedTitle : `${pastedTitle}.txt`,
      type: 'text',
      data: btoa(unescape(encodeURIComponent(pastedText))), // Base64 encode the text
      selected: true
    };

    setSources(prev => [...prev, newSource]);
    logActivity('source_added', newSource.name);
    
    // Reset and close
    setPastedText('');
    setPastedTitle('');
    setIsAddSourceModalOpen(false);
  };

  const toggleSourceSelection = (id: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "" });
      
      const selectedSources = sources.filter(s => s.selected && s.data);
      
      const parts = selectedSources.map(s => {
        if (s.type === 'pdf') {
          return {
            inlineData: {
              mimeType: 'application/pdf',
              data: s.data!
            }
          };
        } else {
          // For text, we can pass it as a text part or plain text inline data
          const decodedText = decodeURIComponent(escape(atob(s.data!)));
          return {
            text: `Conteúdo da fonte "${s.name}":\n${decodedText}`
          };
        }
      });

      const sourceList = selectedSources.map((s, idx) => `[Source ID: ${idx + 1}] ${s.name}`).join('\n');

      parts.push({
        text: `
          Você é o assistente inteligente do Muneri Notebooks.
          Contexto do notebook atual: ${selectedNotebook?.title}.
          Descrição das fontes: ${selectedNotebook?.description}.
          
          Fontes disponíveis:
          ${sourceList}

          Responda à pergunta do usuário com base nas fontes PDF fornecidas. 
          REGRAS CRÍTICAS:
          1. Sempre que usar informação de uma fonte, adicione uma citação no formato [Doc X, pg Y] imediatamente após a frase relevante, onde X é o ID da Fonte e Y é a página (se conseguir identificar).
          2. Use uma linguagem clara e informativa.
          3. Cite apenas as fontes que realmente contribuíram para a resposta.
          
          Pergunta: ${userMessage.content}
        `
      } as any);

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: parts as any }
      });
      
      const text = response.text || "Sem resposta.";

      // Extract citation IDs using regex
      const citationMatches = text.match(/\[Doc (\d+)(?:, pg (\d+))?\]/g);
      const uniqueCitations = citationMatches 
        ? Array.from(new Set(citationMatches.map(m => parseInt(m.match(/\[Doc (\d+)/)![1]))))
        : [];

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
        citations: uniqueCitations
      };

      setMessages(prev => [...prev, assistantMessage]);
      logActivity('message_sent', userMessage.content.slice(0, 40) + (userMessage.content.length > 40 ? '...' : ''));
    } catch (error) {
      console.error("Error generating response:", error);
      setMessages(prev => [...prev, {
        id: 'error',
        role: 'assistant',
        content: "Desculpe, ocorreu um erro ao processar sua solicitação."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeDocument = async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source || !source.data || isLoading) return;

    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Resuma o documento: ${source.name}`
    }]);

    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "" });
      
      const parts: any[] = [];
      if (source.type === 'pdf') {
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: source.data
          }
        });
      } else {
        const decodedText = decodeURIComponent(escape(atob(source.data)));
        parts.push({
          text: `Conteúdo do documento a ser resumido:\n${decodedText}`
        });
      }

      parts.push({
        text: "Forneça um resumo executivo conciso deste documento. Destaque os pontos principais em tópicos."
      });

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: parts as any
        }
      });
      
      const text = response.text || "Não foi possível gerar um resumo.";

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text
      }]);
      logActivity('document_summarized', source.name);
    } catch (error) {
      console.error("Error summarizing document:", error);
      setMessages(prev => [...prev, {
        id: 'error',
        role: 'assistant',
        content: "Desculpe, ocorreu um erro ao gerar o resumo do documento."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSemanticSearch = async (query: string) => {
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: `🔍 Busca Semântica: ${query}`
    }]);

    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "" });
      const availableSources = sources.filter(s => s.data);
      
      const parts = availableSources.map(s => {
        if (s.type === 'pdf') {
          return {
            inlineData: {
              mimeType: 'application/pdf',
              data: s.data!
            }
          };
        } else {
          const decodedText = decodeURIComponent(escape(atob(s.data!)));
          return {
            text: `Conteúdo da fonte "${s.name}":\n${decodedText}`
          };
        }
      });

      const sourceList = availableSources.map((s, idx) => `[Source ID: ${idx + 1}] ${s.name}`).join('\n');

      parts.push({
        text: `
          Você é o motor de busca semântica do Muneri Notebooks.
          Sua tarefa é encontrar informações específicas através dos documentos fornecidos.
          
          Fontes disponíveis:
          ${sourceList}

          Responda de forma direta.
          REGRA CRÍTICA: Sempre que encontrar informação, adicione uma citação no formato [Doc X, pg Y] no final da frase, onde X é o ID da Fonte e Y é a página.
          
          Pergunta de busca: ${query}
        `
      } as any);

      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: parts as any }
      });
      
      const text = result.text || "Nenhum resultado encontrado.";

      // Extract citation IDs using regex
      const citationMatches = text.match(/\[Doc (\d+)(?:, pg (\d+))?\]/g);
      const uniqueCitations = citationMatches 
        ? Array.from(new Set(citationMatches.map(m => parseInt(m.match(/\[Doc (\d+)/)![1]))))
        : [];

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `### 🔍 Resultado da Busca Semântica\n\n${text}`,
        citations: uniqueCitations
      }]);
      setSearchQuery('');
      logActivity('semantic_search', query);
    } catch (error) {
      console.error("Error in semantic search:", error);
      setMessages(prev => [...prev, {
        id: 'error',
        role: 'assistant',
        content: "Erro ao realizar busca semântica. Verifique se os arquivos foram carregados corretamente."
      }]);
    } finally {
      setIsSearching(false);
    }
  };

  const themeVars =
    themeMode === 'dark'
      ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
      : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  return (
    <main className={`${themeVars} h-screen bg-[var(--parchment)] text-[var(--ink)] font-sans antialiased flex flex-col overflow-hidden`}>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--navBg)] px-4 py-3 shrink-0 transition-colors duration-300 shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            {view === 'notebook' && (
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="icon-btn md:hidden"
              >
                <Menu size={20} />
              </button>
            )}
            <Link href="#" onClick={(e) => { e.preventDefault(); setView('home'); }} className="flex items-center gap-2 sm:gap-3 group">
              <div className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-xs sm:text-sm font-bold text-black transition-transform group-hover:scale-110">∂</div>
              <span className="font-serif text-lg sm:text-xl italic text-[var(--gold2)]">Muneri</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={toggleThemeMode}
              className="btn-border !p-2 sm:!px-4 sm:!py-2"
            >
              <Settings size={14} className="sm:hidden" />
              <span className="hidden sm:inline">{themeMode === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
            </button>
            <button 
              className={`btn-border !p-2 sm:!p-2.5 ${isActivityPanelOpen ? 'border-[var(--gold2)] text-[var(--gold2)]' : ''}`}
              onClick={() => setIsActivityPanelOpen(!isActivityPanelOpen)}
            >
              <History size={16} />
            </button>
            <button className="btn-gold !px-3 !py-1.5 sm:!px-4 sm:!py-2 text-xs sm:text-sm">
              <span className="hidden xs:inline">Compartilhar</span>
              <Share2 size={14} className="xs:hidden" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'home' ? (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full overflow-y-auto"
            >
              <header className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 md:px-12 md:py-20 lg:py-24">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--green)]">
                  Muneri · Seus Notebooks Académicos
                </p>
                <h1 className="mt-4 font-serif text-[1.8rem] xs:text-[2.2rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl text-[var(--ink)] max-w-4xl">
                  Trabalhos académicos com <em className="text-[var(--gold2)] normal-case not-italic">inteligência e precisão.</em>
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg opacity-80">
                  Organize suas fontes, faça buscas semânticas e gere resumos automáticos para seus estudos.
                </p>
              </header>

              <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-6 md:px-12">
                <div className="flex items-center justify-between mb-8">
                  <p className="label-mono">Notebooks Recentes</p>
                  <button 
                    onClick={() => handleOpenNotebook({
                      id: crypto.randomUUID(),
                      title: 'Novo Notebook',
                      icon: '📔',
                      sources: [],
                      lastModified: 'Agora',
                      description: 'Comece um novo estudo aqui.'
                    })}
                    className="btn-gold"
                  >
                    <Plus size={16} /> Criar Novo
                  </button>
                </div>

                <div className="grid gap-px bg-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 shadow-2xl">
                  {notebooks.map((nb) => (
                    <article 
                      key={nb.id}
                      onClick={() => handleOpenNotebook(nb)}
                      className="group relative space-y-4 bg-[var(--parchment)] p-6 sm:p-8 transition-all hover:bg-[var(--border)]/10 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded border border-[var(--border)] bg-[var(--parchment)] text-xl sm:text-2xl transition-transform group-hover:scale-110 shadow-sm">
                          {nb.icon}
                        </div>
                        <span className="label-mono text-[var(--gold2)] bg-[var(--gold2)]/10 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px]">{nb.sources.length} Fontes</span>
                      </div>
                      <h3 className="font-serif text-xl sm:text-2xl group-hover:text-[var(--gold2)] transition-colors leading-tight">{nb.title}</h3>
                      <p className="text-xs sm:text-sm leading-relaxed text-[var(--muted)] line-clamp-2 opacity-70">{nb.description}</p>
                      <div className="pt-4 sm:pt-6 flex items-center justify-between border-t border-[var(--border)]">
                        <span className="label-mono opacity-60 italic normal-case text-[9px] sm:text-[10px]">{nb.lastModified}</span>
                        <ChevronRight size={14} className="text-[var(--gold2)] group-hover:translate-x-1.5 transition-transform" />
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <footer className="border-t border-[var(--border)] px-5 py-6 sm:px-6 md:px-12">
                <div className="mx-auto max-w-7xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
                    Muneri · Gerador de Trabalhos Académicos · 2026
                  </div>
                  <div className="text-sm italic text-[var(--faint)]">feito com ∂ em Quelimane, Moçambique</div>
                </div>
              </footer>
            </motion.div>
          ) : (
            <motion.div 
              key="notebook"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full overflow-hidden"
            >
              {/* Left Panel: Sources */}
              <AnimatePresence>
                {(isSidebarOpen || typeof window !== 'undefined' && window.innerWidth >= 768) && (
                  <motion.aside 
                    initial={{ x: -300 }}
                    animate={{ x: 0 }}
                    exit={{ x: -300 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={`fixed inset-y-0 left-0 z-40 w-[280px] sm:w-[300px] border-r border-[var(--border)] bg-[var(--parchment)] flex flex-col pt-[60px] md:pt-0 md:relative md:flex md:translate-x-0 ${isSidebarOpen ? 'shadow-2xl' : ''}`}
                  >
                    <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                      <span className="label-mono">Repositório de Fontes</span>
                      <button onClick={() => setIsSidebarOpen(false)} className="icon-btn text-[var(--faint)] md:hidden">
                        <X size={18} />
                      </button>
                      <button className="icon-btn text-[var(--faint)] hidden md:block">
                        <SquareChevronRight size={16} />
                      </button>
                    </div>
                
                <div className="p-4 space-y-4">
                  <div className="bg-[var(--parchment)] border border-[var(--border)] rounded-xl p-4">
                    <h3 className="label-mono mb-2 text-[var(--faint)]">Processar Documentos</h3>
                    <button 
                      onClick={() => setIsAddSourceModalOpen(true)}
                      className="btn-gold w-full flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Adicionar Fonte
                    </button>
                    <input 
                      type="file" 
                      accept=".pdf" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={(e) => {
                        handleFileUpload(e);
                        setIsAddSourceModalOpen(false);
                      }}
                    />
                  </div>
                  
                  <div className="relative">
                    {isSearching ? (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--gold2)] border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" size={14} />
                    )}
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch(searchQuery)}
                      placeholder={isSearching ? "Analisando vetores..." : "Busca semântica..."} 
                      className="w-full bg-transparent border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--gold2)] outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
                  <div>
                    <div className="flex items-center justify-between label-mono border-b border-[var(--border)] pb-2 mb-4">
                      <span>Inventário Activo</span>
                      <span className="text-[var(--gold2)]">{sources.filter(s => s.selected).length} Sel.</span>
                    </div>
                    
                    <div className="space-y-2">
                      {sources.map((source) => (
                        <div 
                          key={source.id}
                          id={`source-${source.id}`}
                          onClick={() => toggleSourceSelection(source.id)}
                          className={`p-3 bg-[var(--parchment)] border transition-all relative overflow-hidden rounded-xl cursor-pointer hover:border-[var(--gold2)] group ${
                            source.id === highlightedSourceId 
                              ? 'border-[var(--gold2)] ring-2 ring-[var(--gold2)]/20 scale-[1.02]' 
                              : source.selected ? 'border-[var(--gold2)]/40' : 'border-[var(--border)]'
                          }`}
                        >
                          {source.selected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--gold2)]"></div>}
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${source.selected ? 'bg-[var(--gold2)]/20 text-[var(--gold2)]' : 'bg-[var(--border)]/20 text-[var(--faint)]'} font-mono text-[10px] font-bold shrink-0`}>
                              {source.type.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-[var(--ink)] font-medium truncate group-hover:text-[var(--gold2)] transition-colors">
                                {source.name}
                              </div>
                              <p className="text-[9px] text-[var(--faint)] mt-0.5 font-mono">
                                {source.type === 'pdf' ? (source.data ? 'Vectorizado com ∂' : 'Fonte Local') : 'Texto Customizado'}
                              </p>
                            </div>
                            <div className={`w-5 h-5 rounded-full transition-all ${source.selected ? 'bg-[var(--gold2)] text-black border-none' : 'border border-[var(--border)]'} flex items-center justify-center text-[10px]`}>
                              {source.selected && <Check size={12} strokeWidth={3} />}
                            </div>
                          </div>
                          {source.data && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSummarizeDocument(source.id);
                              }}
                              className="mt-3 w-full border border-[var(--border)] rounded-lg py-1.5 text-[9px] font-bold text-[var(--gold2)] uppercase tracking-wider hover:bg-[var(--gold2)]/5 transition-all"
                            >
                              Resumir Documento
                            </button>
                          )}
                        </div>
                      ))}
                      {sources.length === 0 && (
                        <div className="text-center py-12 text-[var(--faint)] space-y-2">
                           <History size={24} className="mx-auto opacity-20" />
                           <p className="label-mono italic">Sem fontes carregadas</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="label-mono mb-3 text-[var(--faint)]">Ativos Anteriores</div>
                    <div className="space-y-2 opacity-50">
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--border)]/10 group cursor-pointer transition-colors border border-transparent hover:border-[var(--border)]">
                        <span className="text-xs text-[var(--muted)] truncate">Index_Geral_Estudo.pdf</span>
                        <span className="font-mono text-[8px] text-[var(--faint)]">2h ago</span>
                      </div>
                    </div>
                    </div>
                  </div>
                </motion.aside>
                )}
              </AnimatePresence>

              {/* Mobile Sidebar Overlay */}
              <AnimatePresence>
                {isSidebarOpen && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 z-30 bg-black/40 md:hidden"
                  />
                )}
              </AnimatePresence>

              {/* Middle Panel: Chat Area */}
              <div className="flex-1 flex flex-col min-w-0 bg-[var(--parchment)] relative">

                <header className="p-3 sm:p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--navBg)]/90 backdrop-blur-md sticky top-0 z-[5]">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="label-mono shrink-0 hidden sm:inline">Diálogo Analítico</span>
                    <div className="h-4 w-px bg-[var(--border)] hidden sm:block"></div>
                    <div className="flex items-center gap-2 min-w-0">
                       <span className="text-[11px] font-serif italic text-[var(--gold2)] truncate">
                         {selectedNotebook?.title}
                       </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {messages.length > 0 && (
                      <button 
                        className="btn-border !px-2 !py-1 text-[9px] sm:!px-2.5"
                        onClick={handleCopyAll}
                        title="Copiar tudo"
                      >
                        <Copy size={12} className="sm:size-[13px]" /> 
                        <span className="hidden xs:inline">Copiar Tudo</span>
                      </button>
                    )}
                    <button className="icon-btn text-[var(--faint)]"><Search size={16} /></button>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12 space-y-6 sm:space-y-10 scroll-smooth">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center gap-4 sm:gap-6 py-12 sm:py-20 text-center animate-in fade-in zoom-in-95 duration-700">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] rounded-2xl sm:rounded-3xl flex items-center justify-center text-3xl sm:text-4xl shadow-2xl relative">
                        {selectedNotebook?.icon}
                        <div className="absolute -inset-2 bg-[var(--gold2)]/20 blur-xl rounded-full -z-10 animate-pulse"></div>
                      </div>
                      <div className="space-y-2 sm:space-y-4 px-4">
                        <h2 className="font-serif text-2xl sm:text-3xl text-[var(--ink)] tracking-tight">{selectedNotebook?.title}</h2>
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                          <span className="label-mono bg-[var(--border)]/30 px-2 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px]">
                            {sources.length} Fontes
                          </span>
                          <span className="label-mono bg-[var(--border)]/30 px-2 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px]">
                            {selectedNotebook?.lastModified}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base text-[var(--muted)] max-w-lg leading-relaxed mx-auto">
                          {selectedNotebook?.description}
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                    >
                      <div 
                        className={`max-w-[90%] sm:max-w-[80%] p-6 rounded-xl text-sm leading-relaxed shadow-sm transition-colors ${
                          msg.role === 'user' 
                            ? 'bg-[var(--gold2)]/5 border border-[var(--gold2)]/20 rounded-br-none text-[var(--ink)] shadow-[0_0_40px_-15px_var(--gold2)]' 
                            : 'bg-[var(--parchment)] border border-[var(--border)] text-[var(--muted)]'
                        }`}
                      >
                        <div className={`prose prose-sm prose-invert max-w-none ${msg.role === 'user' ? 'text-[var(--ink)]' : 'text-[var(--muted)]'} text-xs sm:text-sm`}>
                          <ReactMarkdown
                            components={{
                              a: ({ node, ...props }) => {
                                if (props.href?.startsWith('#cite-')) {
                                  const citeId = parseInt(props.href.split('-')[1]);
                                  return (
                                    <span 
                                      onClick={() => handleCitationClick(citeId)}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--gold2)]/10 border border-[var(--gold2)]/30 text-[var(--gold2)] font-bold cursor-pointer hover:bg-[var(--gold2)]/20 transition-colors mx-0.5"
                                    >
                                      {props.children}
                                    </span>
                                  );
                                }
                                return <a {...props} className="text-[var(--gold2)] underline underline-offset-4" />;
                              },
                              p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                              h3: ({ children }) => <h3 className="font-serif text-lg text-[var(--ink)] mt-6 mb-2">{children}</h3>,
                              ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
                            }}
                          >
                            {msg.content.replace(/\[Doc (\d+)(?:, pg (\d+))?\]/g, (match, d) => `[${match}](#cite-${d})`)}
                          </ReactMarkdown>
                        </div>
                        {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-[var(--border)]">
                            <div className="flex flex-wrap gap-2">
                              {msg.citations.map((citeId) => {
                                const activeSources = sources.filter(s => s.selected || s.data);
                                const source = activeSources[citeId - 1];
                                return (
                                  <button 
                                    key={citeId}
                                    onClick={() => handleCitationClick(citeId)}
                                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
                                  >
                                    <FileText size={10} /> 
                                    {source ? source.name : `Fonte ${citeId}`}
                                  </button>
                                );
                              })}
                            </div>
                            
                            <div className="mt-4 flex items-center justify-between label-mono text-[8px]">
                              <span className="flex items-center gap-1"><Check size={10} className="text-[var(--green)]" /> Checado</span>
                              <button className="flex items-center gap-2 hover:text-[var(--gold2)] transition-colors">
                                <Copy size={10} /> Copiar Resposta
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex items-center gap-4 bg-[var(--gold2)]/5 border border-[var(--gold2)]/10 p-5 rounded-xl w-fit animate-pulse">
                      <div className="flex gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--gold2)] animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 rounded-full bg-[var(--gold2)] animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 rounded-full bg-[var(--gold2)] animate-bounce"></span>
                      </div>
                      <span className="label-mono text-[var(--gold2)]">Análise Editorial em Curso...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 sm:p-6 bg-[var(--navBg)]/90 backdrop-blur-md border-t border-[var(--border)]">
                  <div className="mx-auto max-w-4xl relative">
                    <textarea 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Faça uma pergunta sobre seus documentos..."
                      className="w-full bg-[var(--parchment)] border border-[var(--border)] rounded-2xl pl-4 sm:pl-6 pr-12 sm:pr-14 py-3 sm:py-4 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--gold2)] outline-none transition-all shadow-xl resize-none max-h-[150px] sm:max-h-[200px]"
                      rows={1}
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={isLoading || !inputValue.trim()}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 grid place-items-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black shadow-lg disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
                    >
                      <Send size={16} className="sm:size-18" />
                    </button>
                  </div>
                  <div className="mt-2 sm:mt-3 text-center">
                    <span className="label-mono text-[var(--faint)] text-[7px] sm:text-[9px]">Pressione Enter para enviar · Shift+Enter para nova linha</span>
                  </div>
                </div>
              </div>

              {/* Right Panel: Recent Activity */}
              <AnimatePresence>
                {isActivityPanelOpen && (
                  <motion.aside 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="shrink-0 border-l border-[var(--border)] bg-[var(--parchment)] flex flex-col overflow-hidden"
                  >
                    <div className="p-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
                      <span className="label-mono">Atividade Recente</span>
                      <button onClick={() => setIsActivityPanelOpen(false)} className="icon-btn">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {recentActivity.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-[var(--faint)] space-y-2 opacity-50">
                          <Clock size={24} strokeWidth={1.5} />
                          <span className="label-mono">Sem atividade</span>
                        </div>
                      ) : (
                        recentActivity.map((activity) => (
                          <div key={activity.id} className="p-3 bg-[var(--parchment)] border border-[var(--border)] rounded-xl space-y-1 relative group hover:border-[var(--gold2)]/40 transition-all">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[8px] font-bold text-[var(--gold2)] uppercase tracking-tighter">
                                {activity.type.replace('_', ' ')}
                              </span>
                              <span className="font-mono text-[8px] text-[var(--muted)]">
                                {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--ink)] font-medium leading-normal line-clamp-2">
                              {activity.title}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <footer className="p-4 border-t border-[var(--border)] bg-[var(--parchment)] text-center">
                       <span className="font-mono text-[8px] text-[var(--faint)] uppercase tracking-[0.3em]">Feed de Sessão</span>
                    </footer>
                  </motion.aside>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Source Modal */}
        <AnimatePresence>
          {isAddSourceModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddSourceModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-[var(--parchment)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-4 sm:p-6 border-b border-[var(--border)] flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl sm:text-2xl text-[var(--ink)]">Adicionar Fonte</h2>
                    <p className="label-mono mt-1 text-[9px] sm:text-[10px]">Escolha como deseja importar</p>
                  </div>
                  <button onClick={() => setIsAddSourceModalOpen(false)} className="icon-btn text-[var(--faint)]">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex border-b border-[var(--border)]">
                  <button 
                    onClick={() => setAddSourceTab('file')}
                    className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${addSourceTab === 'file' ? 'text-[var(--gold2)] bg-[var(--gold2)]/5 border-b-2 border-[var(--gold2)]' : 'text-[var(--faint)] hover:text-[var(--ink)]'}`}
                  >
                    Arquivo PDF
                  </button>
                  <button 
                    onClick={() => setAddSourceTab('text')}
                    className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${addSourceTab === 'text' ? 'text-[var(--gold2)] bg-[var(--gold2)]/5 border-b-2 border-[var(--gold2)]' : 'text-[var(--faint)] hover:text-[var(--ink)]'}`}
                  >
                    Texto Direto
                  </button>
                </div>

                <div className="p-4 sm:p-6">
                  {addSourceTab === 'file' ? (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[var(--border)] rounded-xl py-8 sm:py-12 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--gold2)] hover:bg-[var(--gold2)]/5 transition-all group"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--faint)] group-hover:text-[var(--gold2)] group-hover:bg-[var(--gold2)]/10 transition-colors mb-3 sm:mb-4">
                        <Plus size={20} className="sm:size-24" />
                      </div>
                      <p className="font-serif text-base sm:text-lg text-[var(--ink)]">Clique para selecionar PDF</p>
                      <p className="label-mono mt-1 opacity-60 text-[9px] sm:text-[10px]">Suporta apenas arquivos .pdf</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="label-mono mb-2 block">Título da Fonte</label>
                        <input 
                          type="text" 
                          value={pastedTitle}
                          onChange={(e) => setPastedTitle(e.target.value)}
                          placeholder="Ex: Notas de Aula - Biologia"
                          className="w-full bg-transparent border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold2)] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="label-mono mb-2 block">Conteúdo</label>
                        <textarea 
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          placeholder="Cole ou digite o texto aqui..."
                          rows={8}
                          className="w-full bg-transparent border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold2)] transition-colors resize-none"
                        />
                      </div>
                      <button 
                        onClick={handleAddTextSource}
                        disabled={!pastedText.trim() || !pastedTitle.trim()}
                        className="btn-gold w-full flex items-center justify-center py-3"
                      >
                        Salvar Fonte de Texto
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
