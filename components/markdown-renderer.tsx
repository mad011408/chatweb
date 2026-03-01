'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children, ...props }) => {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (match) {
    return (
      <div className="relative group rounded-lg overflow-hidden my-4 border border-white/10">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 text-zinc-400 text-xs font-mono border-b border-white/10">
          <span>{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
            aria-label="Copy code"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
        <SyntaxHighlighter
          {...props}
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: 0, background: '#0a0a0a' }}
          codeTagProps={{ className: 'text-sm font-mono' }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className="bg-zinc-800/50 text-emerald-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
      {children}
    </code>
  );
};

export const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <div className="markdown-body prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock as any,
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
