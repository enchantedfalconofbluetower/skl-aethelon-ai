
import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, AlertCircle, Globe, BrainCircuit, Zap, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { Sidebar } from './components/Sidebar';
import { InputArea } from './components/InputArea';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { sendMessageStream, generateImage, checkApiKey } from './services/geminiService';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, APP_NAME } from './constants';
import { ChatSession, Message, Role, Attachment, GroundingChunk } from './types';
import { Logo } from './components/Logo';

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(DEFAULT_MODEL_ID);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Setup
  useEffect(() => {
    if (!checkApiKey()) {
      setError("API Key missing. Check configuration.");
    }
    if (sessions.length === 0) {
      createNewSession();
    }
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Close model menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentSessionId) scrollToBottom();
  }, [sessions, currentSessionId]);

  const getCurrentSession = (): ChatSession | undefined => {
    return sessions.find(s => s.id === currentSessionId);
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      modelId: currentModelId,
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setSidebarOpen(false);
  };

  const updateSessionMessages = (sessionId: string, newMessages: Message[], newTitle?: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        return { 
            ...session, 
            messages: newMessages, 
            title: newTitle || session.title, 
            updatedAt: Date.now() 
        };
      }
      return session;
    }));
  };

  const handleSendMessage = async (content: string, attachments: Attachment[]) => {
    if (!currentSessionId) return;
    const session = getCurrentSession();
    if (!session) return;
    const modelConfig = AVAILABLE_MODELS.find(m => m.id === currentModelId);

    setIsLoading(true);
    setError(null);

    // Create User Message
    const userMessage: Message = {
      id: uuidv4(),
      role: Role.User,
      content,
      attachments,
      timestamp: Date.now(),
    };

    // Determine title if it's the first message
    let newTitle = session.title;
    if (session.messages.length === 0) {
      newTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }

    const updatedMessages = [...session.messages, userMessage];
    updateSessionMessages(currentSessionId, updatedMessages, newTitle);

    // Create Placeholder Model Message
    const modelMessageId = uuidv4();
    const modelMessage: Message = {
      id: modelMessageId,
      role: Role.Model,
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    updateSessionMessages(currentSessionId, [...updatedMessages, modelMessage], newTitle);

    try {
      // CHECK IF IMAGE GENERATION MODEL
      if (modelConfig?.capabilities.imageGeneration) {
        const imageBase64 = await generateImage(content, currentModelId);
        
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const msgs = s.messages.map(m => {
              if (m.id === modelMessageId) {
                return { 
                  ...m, 
                  isStreaming: false,
                  content: `Generated image for: "${content}"`,
                  generatedImage: imageBase64
                };
              }
              return m;
            });
            return { ...s, messages: msgs };
          }
          return s;
        }));

      } else {
        // STANDARD TEXT GENERATION
        const stream = await sendMessageStream(
          currentSessionId, 
          currentModelId, 
          content, 
          attachments,
          session.messages 
        );
        
        let accumulatedText = '';
        let accumulatedGrounding: any = null;

        for await (const chunk of stream) {
          accumulatedText += chunk.text;
          if (chunk.groundingMetadata) {
            accumulatedGrounding = chunk.groundingMetadata;
          }
          
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              const msgs = s.messages.map(m => {
                if (m.id === modelMessageId) {
                  return { 
                    ...m, 
                    content: accumulatedText,
                    groundingMetadata: accumulatedGrounding
                  };
                }
                return m;
              });
              return { ...s, messages: msgs };
            }
            return s;
          }));
        }

        // Finalize Text
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const msgs = s.messages.map(m => {
              if (m.id === modelMessageId) {
                return { ...m, isStreaming: false };
              }
              return m;
            });
            return { ...s, messages: msgs };
          }
          return s;
        }));
      }

    } catch (err: any) {
      console.error("Generation error:", err);
      setError("Something went wrong. Please try again or switch models.");
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const msgs = s.messages.map(m => {
            if (m.id === modelMessageId) {
              return { ...m, isStreaming: false, isError: true, content: "Error generating response." };
            }
            return m;
          });
          return { ...s, messages: msgs };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = (newModelId: string) => {
    setCurrentModelId(newModelId);
    setIsModelMenuOpen(false);
    const session = getCurrentSession();
    if (session && session.messages.length === 0) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, modelId: newModelId } : s));
    }
  };

  const currentModelConfig = AVAILABLE_MODELS.find(m => m.id === currentModelId);
  const activeSession = getCurrentSession();

  const getModelIcon = (id: string) => {
    if (id.includes('thinking')) return <BrainCircuit size={18} className="text-purple-400" />;
    if (id.includes('search')) return <Globe size={18} className="text-blue-400" />;
    if (id.includes('imagen')) return <ImageIcon size={18} className="text-pink-400" />;
    return <Zap size={18} className="text-green-400" />;
  };

  return (
    <div className="flex h-screen bg-[#212121] text-gray-100 font-sans overflow-hidden">
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        onNewChat={createNewSession}
        history={sessions}
        onSelectSession={setCurrentSessionId}
        currentSessionId={currentSessionId}
      />

      <div className="flex-1 flex flex-col h-full relative min-w-0 bg-[#212121]">
        
        {/* Header / Model Selector */}
        <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 bg-[#212121] z-10">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
            
            <div className="relative" ref={modelMenuRef}>
               <button 
                 onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                 className="flex items-center gap-1.5 text-lg font-medium text-gray-300 hover:bg-[#2f2f2f] hover:text-white px-3 py-1.5 rounded-lg transition-colors"
               >
                 <span>{currentModelConfig?.name}</span>
                 <ChevronDown size={14} className="text-gray-500" />
               </button>
               
               {isModelMenuOpen && (
                 <div className="absolute top-full left-0 mt-2 w-[280px] bg-[#2f2f2f] border border-gray-700/50 rounded-xl shadow-xl p-1.5 z-50 animate-fade-in flex flex-col gap-0.5">
                   {AVAILABLE_MODELS.map(model => (
                     <button
                       key={model.id}
                       onClick={() => handleModelChange(model.id)}
                       className={`w-full text-left p-2.5 rounded-lg flex items-center gap-3 hover:bg-[#424242] transition-colors ${currentModelId === model.id ? 'bg-[#424242]' : ''}`}
                     >
                       <div className="mt-0.5">{getModelIcon(model.id)}</div>
                       <div className="flex-1">
                         <div className="font-medium text-sm text-gray-200">{model.name}</div>
                         <div className="text-xs text-gray-400">{model.description}</div>
                       </div>
                       {currentModelId === model.id && (
                         <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                       )}
                     </button>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth relative flex flex-col">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center animate-fade-in">
              <div className="w-16 h-16 mb-6 shadow-lg flex items-center justify-center">
                <Logo className="w-full h-full" />
              </div>
              <h2 className="text-2xl font-semibold mb-8 text-white">I'm {APP_NAME}, how can I help?</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                {[
                  "Explain quantum entanglement",
                  "Write a poem about coding",
                  "Debug this Python code",
                  "Plan a 3-day trip to Tokyo"
                ].map((prompt, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSendMessage(prompt, [])}
                    className="p-3.5 border border-gray-700/60 rounded-xl text-left hover:bg-[#2f2f2f] transition-colors text-sm text-gray-300"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[800px] mx-auto px-4 py-6 space-y-8">
               {activeSession.messages.map((msg) => (
                 <div 
                    key={msg.id} 
                    className={`flex gap-4 ${msg.role === Role.User ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Avatar (Model only) */}
                    {msg.role === Role.Model && (
                       <div className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-700 bg-[#171717] flex items-center justify-center mt-0.5 p-1">
                         <Logo className={`w-full h-full ${msg.isStreaming ? 'animate-pulse' : ''}`} />
                       </div>
                    )}
                    
                    <div className={`flex flex-col max-w-[90%] md:max-w-[85%] ${msg.role === Role.User ? 'items-end' : 'items-start'}`}>
                      {/* Status Text (Model && Streaming) */}
                      {msg.role === Role.Model && msg.isStreaming && (
                        <span className="text-xs text-gray-400 mb-1.5 font-mono animate-pulse">
                           {currentModelConfig?.capabilities.imageGeneration ? 'Generating image...' : 'Generating content...'}
                        </span>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2 justify-end">
                          {msg.attachments.map((att, i) => (
                            <img 
                              key={i} 
                              src={att.uri} 
                              alt="attachment" 
                              className="max-w-[200px] max-h-[200px] rounded-xl border border-gray-700 object-cover" 
                            />
                          ))}
                        </div>
                      )}

                      {/* Message Content */}
                      <div className={`relative text-[15px] leading-7 ${
                        msg.role === Role.User 
                          ? 'bg-[#303030] text-white px-5 py-2.5 rounded-[20px]' 
                          : 'text-gray-100 w-full px-1'
                      }`}>
                         {msg.role === Role.Model ? (
                           <>
                             {/* Image Display */}
                             {msg.generatedImage ? (
                               <div className="mt-2">
                                 <img 
                                   src={`data:image/jpeg;base64,${msg.generatedImage}`} 
                                   alt="Generated content" 
                                   className="rounded-xl border border-gray-700 shadow-lg max-w-full"
                                 />
                                 <p className="mt-2 text-sm text-gray-400 italic">{msg.content}</p>
                               </div>
                             ) : (
                               <MarkdownRenderer content={msg.content} />
                             )}

                             {/* Grounding Sources */}
                             {msg.groundingMetadata?.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0 && (
                               <div className="mt-4 pt-3 border-t border-gray-700/50 flex flex-wrap gap-2">
                                  {msg.groundingMetadata.groundingChunks.map((chunk: GroundingChunk, idx: number) => (
                                    chunk.web?.uri && (
                                      <a 
                                        key={idx} 
                                        href={chunk.web.uri}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1.5 bg-[#2f2f2f] hover:bg-[#424242] px-3 py-1 rounded-full text-xs text-blue-300 transition-colors"
                                      >
                                        <Globe size={10} />
                                        <span className="truncate max-w-[150px]">{chunk.web.title || 'Source'}</span>
                                      </a>
                                    )
                                  ))}
                               </div>
                             )}
                           </>
                         ) : (
                           <p className="whitespace-pre-wrap">{msg.content}</p>
                         )}
                      </div>
                    </div>
                 </div>
               ))}
               <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </main>

        {/* Error Toast */}
        {error && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm z-50 backdrop-blur-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Input Area */}
        <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default App;