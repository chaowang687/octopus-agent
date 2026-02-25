import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownViewerProps {
  content: string;
  theme?: 'dark' | 'light';
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, theme = 'dark' }) => {
  const renderCodeBlock = ({ 
    node, 
    inline, 
    className, 
    children, 
    ...props 
  }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const currentTheme = theme === 'dark' ? vscDarkPlus : oneLight;
    
    return !inline && match ? (
      <SyntaxHighlighter
        style={currentTheme}
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className={`markdown-viewer ${theme}`}>
      <ReactMarkdown components={{ code: renderCodeBlock }}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;