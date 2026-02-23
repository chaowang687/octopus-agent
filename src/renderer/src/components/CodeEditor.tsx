import React, { useRef, useEffect, useCallback, useState } from 'react'
import Editor, { Monaco, OnMount } from '@monaco-editor/react'
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api'
import './CodeEditor.css'

export interface CodeEditorProps {
  filePath?: string
  content?: string
  language?: string
  theme?: 'vs-dark' | 'vs-light' | 'hc-black'
  readOnly?: boolean
  onChange?: (value: string) => void
  onSave?: (value: string) => void
  onEditorMount?: (editor: monacoEditor.editor.IStandaloneCodeEditor, monaco: Monaco) => void
}

const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescriptreact',
    'js': 'javascript',
    'jsx': 'javascriptreact',
    'json': 'json',
    'md': 'markdown',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'py': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'sql': 'sql',
    'dockerfile': 'dockerfile',
    'docker': 'dockerfile',
    'env': 'plaintext',
    'gitignore': 'plaintext',
    'dockerignore': 'plaintext',
    'toml': 'ini',
    'ini': 'ini',
    'vue': 'vue',
    'svelte': 'svelte',
  }
  return languageMap[ext] || 'plaintext'
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  filePath,
  content = '',
  language,
  theme = 'vs-dark',
  readOnly = false,
  onChange,
  onSave,
  onEditorMount
}) => {
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const [isModified, setIsModified] = useState(false)
  const [originalContent, setOriginalContent] = useState(content)
  const [currentContent, setCurrentContent] = useState(content)
  
  const detectedLanguage = language || (filePath ? getLanguageFromPath(filePath) : 'plaintext')
  
  useEffect(() => {
    if (content !== originalContent) {
      setOriginalContent(content)
      setCurrentContent(content)
      setIsModified(false)
      
      if (editorRef.current) {
        editorRef.current.setValue(content)
      }
    }
  }, [content, filePath])
  
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue()
      setCurrentContent(value)
      setIsModified(value !== originalContent)
      onChange?.(value)
    })
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const value = editor.getValue()
      onSave?.(value)
      setOriginalContent(value)
      setIsModified(false)
    })
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      editor.getAction('editor.action.formatDocument')?.run()
    })
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run()
    })
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      editor.getAction('editor.action.startFindReplaceAction')?.run()
    })
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      editor.getAction('editor.action.gotoLine')?.run()
    })
    
    onEditorMount?.(editor, monaco)
  }, [onChange, onSave, onEditorMount, originalContent])
  
  const handleSave = useCallback(() => {
    if (editorRef.current) {
      const value = editorRef.current.getValue()
      onSave?.(value)
      setOriginalContent(value)
      setIsModified(false)
    }
  }, [onSave])
  
  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run()
    }
  }, [])
  
  const handleMinimapToggle = useCallback(() => {
    if (editorRef.current) {
      const options = editorRef.current.getRawOptions()
      editorRef.current.updateOptions({
        minimap: { enabled: !options.minimap?.enabled }
      })
    }
  }, [])
  
  return (
    <div className="code-editor-container">
      <div className="code-editor-toolbar">
        <div className="toolbar-left">
          {filePath && (
            <span className="file-path" title={filePath}>
              {filePath.split('/').pop()}
              {isModified && <span className="modified-indicator">●</span>}
            </span>
          )}
        </div>
        <div className="toolbar-right">
          <span className="language-badge">{detectedLanguage}</span>
          <button 
            className="toolbar-btn" 
            onClick={handleFormat}
            title="格式化文档 (Ctrl+B)"
          >
            格式化
          </button>
          <button 
            className="toolbar-btn" 
            onClick={handleMinimapToggle}
            title="切换小地图"
          >
            小地图
          </button>
          {isModified && (
            <button 
              className="toolbar-btn save-btn" 
              onClick={handleSave}
              title="保存 (Ctrl+S)"
            >
              保存
            </button>
          )}
        </div>
      </div>
      
      <div className="code-editor-main">
        <Editor
          height="100%"
          language={detectedLanguage}
          value={currentContent}
          theme={theme}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            fontSize: 14,
            fontFamily: "'Fira Code', 'SF Mono', Monaco, Menlo, Consolas, monospace",
            fontLigatures: true,
            lineHeight: 22,
            letterSpacing: 0.5,
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'off',
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            padding: { top: 8, bottom: 8 },
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'mouseover',
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true
            },
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showClasses: true,
              showFunctions: true,
              showVariables: true,
              showConstants: true
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true
            },
            parameterHints: { enabled: true },
            formatOnPaste: true,
            formatOnType: true,
            renderWhitespace: 'selection',
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            }
          }}
          loading={
            <div className="editor-loading">
              <span className="loading-spinner">⏳</span>
              <span>加载编辑器...</span>
            </div>
          }
        />
      </div>
    </div>
  )
}

export default CodeEditor
