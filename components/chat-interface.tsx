'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Send, Settings2, Bot, User, Loader2, Menu, X, PlusCircle, Trash2, Zap, Globe } from 'lucide-react';
import { MarkdownRenderer } from './markdown-renderer';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are an elite, highly advanced AI assistant and expert software engineer. Provide exceptionally accurate, professional, and well-structured responses. Think step-by-step for complex problems. When writing code, ensure it is production-ready, optimized, and follows best practices. Be concise but thorough.'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'custom'>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview'); // Default to flash for speed
  const [customApiKey, setCustomApiKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('https://api.openai.com/v1');
  const [customModel, setCustomModel] = useState('gpt-3.5-turbo');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize or reset chat when system prompt or model changes
  useEffect(() => {
    if (provider === 'custom') {
      setMessages([]);
      return;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    chatRef.current = ai.chats.create({
      model: selectedModel,
      config: {
        systemInstruction: systemPrompt,
        // Using high token limits as requested
        maxOutputTokens: 1000000,
        temperature: 0.2, // Ultra low temperature for maximum speed and focus
      },
    });
    // Clear messages when settings change to start a fresh context
    setMessages([]);
  }, [systemPrompt, selectedModel, provider, customBaseUrl, customModel]);

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear the current chat?')) {
      setMessages([]);
      if (provider === 'gemini') {
        // Re-initialize chat to clear history
        const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
        chatRef.current = ai.chats.create({
          model: selectedModel,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 1000000,
            temperature: 0.2,
          },
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const modelMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: modelMessageId, role: 'model', content: '' },
    ]);

    try {
      if (provider === 'gemini') {
        if (!chatRef.current) return;
        const streamResponse = await chatRef.current.sendMessageStream({
          message: userMessage.content,
        });

        for await (const chunk of streamResponse) {
          const c = chunk as GenerateContentResponse;
          if (c.text) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === modelMessageId
                  ? { ...msg, content: msg.content + c.text }
                  : msg
              )
            );
          }
        }
      } else {
        // Custom LLM via API route to bypass CORS
        const response = await fetch('/api/custom-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            baseUrl: customBaseUrl,
            apiKey: customApiKey,
            model: customModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content })),
              { role: 'user', content: userMessage.content }
            ],
            stream: true,
            temperature: 0.2, // Low temp for faster, more focused responses
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === modelMessageId
                        ? { ...msg, content: msg.content + content }
                        : msg
                    )
                  );
                }
              } catch (e) {
                // Ignore partial JSON parsing errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          content: `**Error:** Failed to generate response. Please check your API key and Base URL. \n\nDetails: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: isSidebarOpen ? 0 : -300 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-zinc-900 border-r border-white/10 flex flex-col transform lg:transform-none lg:translate-x-0 transition-transform`}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium text-emerald-400">
            <Settings2 className="w-5 h-5" />
            <span>Settings</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 hover:bg-white/10 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Provider
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setProvider('gemini')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs transition-colors ${
                    provider === 'gemini'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                      : 'bg-zinc-950 border-white/10 text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Bot className="w-5 h-5 mb-1" />
                  <span className="font-semibold">Gemini</span>
                </button>
                <button
                  onClick={() => setProvider('custom')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs transition-colors ${
                    provider === 'custom'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                      : 'bg-zinc-950 border-white/10 text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Globe className="w-5 h-5 mb-1" />
                  <span className="font-semibold">Custom LLM</span>
                </button>
              </div>
            </div>

            {provider === 'custom' && (
              <div className="space-y-3 mb-4 p-4 bg-zinc-950 rounded-lg border border-white/5">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">API Key</label>
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Model Name</label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="gpt-4o"
                    className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            )}

            {provider === 'gemini' && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Gemini Model
                </label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs transition-colors ${
                      selectedModel === 'gemini-3.1-pro-preview'
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <Bot className="w-5 h-5 mb-1" />
                    <span className="font-semibold">Pro</span>
                    <span className="text-[10px] opacity-70">Advanced</span>
                  </button>
                  <button
                    onClick={() => setSelectedModel('gemini-3-flash-preview')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs transition-colors ${
                      selectedModel === 'gemini-3-flash-preview'
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <Zap className="w-5 h-5 mb-1" />
                    <span className="font-semibold">Flash</span>
                    <span className="text-[10px] opacity-70">Ultra Fast</span>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-48 bg-zinc-950 border border-white/10 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                placeholder="Enter system instructions..."
              />
              <p className="text-xs text-zinc-500 mt-2">
                Changing the system prompt will start a new chat session.
              </p>
            </div>

            <div className="p-4 bg-zinc-950 rounded-lg border border-white/5">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Model Info</h3>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li className="flex justify-between">
                  <span>Model:</span>
                  <span className="text-zinc-300 text-right">
                    {provider === 'custom' ? customModel : (selectedModel === 'gemini-3.1-pro-preview' ? 'Gemini 3.1 Pro' : 'Gemini 3 Flash')}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Context Window:</span>
                  <span className="text-zinc-300">1M Tokens</span>
                </li>
                <li className="flex justify-between">
                  <span>Max Output:</span>
                  <span className="text-zinc-300">1M Tokens</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-14 border-b border-white/10 flex items-center px-4 justify-between bg-zinc-950/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-md text-zinc-400 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-zinc-100 flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 p-1 rounded-md">
                {provider === 'custom' ? <Globe className="w-4 h-4" /> : (selectedModel === 'gemini-3.1-pro-preview' ? <Bot className="w-4 h-4" /> : <Zap className="w-4 h-4" />)}
              </span>
              {provider === 'custom' ? 'Custom LLM' : (selectedModel === 'gemini-3.1-pro-preview' ? 'Gemini Pro' : 'Gemini Flash')} Chat
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMessages([]);
                if (provider === 'gemini') {
                  const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
                  chatRef.current = ai.chats.create({
                    model: selectedModel,
                    config: {
                      systemInstruction: systemPrompt,
                      maxOutputTokens: 1000000,
                      temperature: 0.2,
                    },
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-md transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 opacity-60">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/10">
                <Bot className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-medium">How can I help you today?</h2>
              <p className="text-sm text-zinc-400">
                Powered by {provider === 'custom' ? customModel : (selectedModel === 'gemini-3.1-pro-preview' ? 'Gemini 3.1 Pro' : 'Gemini 3 Flash')}. Ask me anything, or paste large codebases.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={`flex gap-4 max-w-4xl mx-auto ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-zinc-800 border border-white/10'
                      : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`flex-1 min-w-0 ${
                    msg.role === 'user'
                      ? 'bg-zinc-900 border border-white/10 rounded-2xl rounded-tr-sm px-5 py-3 text-zinc-200'
                      : 'pt-1'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-zinc-950 border-t border-white/10">
          <div className="max-w-4xl mx-auto relative">
            <form
              onSubmit={handleSubmit}
              className="relative flex items-end gap-2 bg-zinc-900 border border-white/10 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/50 transition-all"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={`Message ${provider === 'custom' ? customModel : (selectedModel === 'gemini-3.1-pro-preview' ? 'Gemini Pro' : 'Gemini Flash')}...`}
                className="w-full max-h-48 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-2.5 px-3 text-zinc-200 placeholder:text-zinc-500 text-sm"
                rows={1}
                style={{ height: 'auto' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 flex items-center justify-center transition-colors mb-0.5"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5 ml-0.5" />
                )}
              </button>
            </form>
            <div className="text-center mt-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                {provider === 'custom' ? customModel : (selectedModel === 'gemini-3.1-pro-preview' ? 'Gemini 3.1 Pro' : 'Gemini 3 Flash')} • {provider === 'custom' ? 'Custom Endpoint' : '1M Context Window'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
