import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './MessageContent.css'

interface MessageContentProps {
  content: string
}

const MessageContentComponent: React.FC<MessageContentProps> = ({ content }) => {
  const handleFileClick = (filePath: string) => {
    if (window.electron?.system?.openPath) {
      window.electron.system.openPath(filePath)
    }
  }

  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : ''
      
      if (!inline && match) {
        return (
          <div className="code-block-wrapper">
            <div className="code-block-header">
              <span className="code-language">{language}</span>
              <button 
                className="copy-button"
                onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
              >
                复制
              </button>
            </div>
            <SyntaxHighlighter
              style={oneDark}
              language={language}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: '0 0 6px 6px',
                fontSize: '13px'
              }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        )
      }
      
      return (
        <code className={`inline-code ${className}`} {...props}>
          {children}
        </code>
      )
    },
    
    a({ node, href, children, ...props }: any) {
      const isFilePath = href?.startsWith('/') || href?.includes(':')
      
      if (isFilePath) {
        return (
          <button 
            className="file-link-button"
            onClick={() => href && handleFileClick(href)}
          >
            📄 {children}
          </button>
        )
      }
      
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="message-link"
          {...props}
        >
          {children}
        </a>
      )
    },

    input({ node, type, checked, ...props }: any) {
      if (type === 'checkbox') {
        return (
          <input 
            type="checkbox" 
            checked={checked} 
            readOnly 
            className="task-checkbox"
            {...props} 
          />
        )
      }
      return <input type={type} {...props} />
    },

    li({ node, children, ...props }: any) {
      const hasCheckbox = String(children).includes('[ ]') || String(children).includes('[x]') || String(children).includes('[X]')
      
      if (hasCheckbox) {
        return (
          <li className="task-list-item" {...props}>
            {children}
          </li>
        )
      }
      
      return <li {...props}>{children}</li>
    },

    h1({ node, children, ...props }: any) {
      return <h1 className="message-h1" {...props}>{children}</h1>
    },
    
    h2({ node, children, ...props }: any) {
      return <h2 className="message-h2" {...props}>{children}</h2>
    },
    
    h3({ node, children, ...props }: any) {
      return <h3 className="message-h3" {...props}>{children}</h3>
    },

    table({ node, children, ...props }: any) {
      return (
        <div className="table-wrapper">
          <table className="message-table" {...props}>
            {children}
          </table>
        </div>
      )
    },

    blockquote({ node, children, ...props }: any) {
      return <blockquote className="message-blockquote" {...props}>{children}</blockquote>
    },

    hr({ node, ...props }: any) {
      return <hr className="message-hr" {...props} />
    }
  }

  return (
    <div className="message-content">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MessageContentComponent
