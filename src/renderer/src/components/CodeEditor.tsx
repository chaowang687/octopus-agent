import React, { useRef, useEffect, useCallback, useState } from 'react'
import Editor, { Monaco, OnMount } from '@monaco-editor/react'
import './CodeEditor.css'

export interface CodeEditorProps {
  filePath?: string
  content?: string
  language?: string
  theme?: 'vs-dark' | 'vs-light' | 'hc-black'
  readOnly?: boolean
  onChange?: (value: string) => void
  onSave?: (value: string) => void
  onEditorMount?: (editor: any, monaco: Monaco) => void
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
    'cs': 'csharp',
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
  const editorRef = useRef<any>(null)
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
        {filePath && (
          <span className="file-path" title={filePath}>
            {filePath.split('/').pop()}
            {isModified && <span className="modified-indicator">*</span>}
          </span>
        )}
        <span className="language-badge">{detectedLanguage}</span>
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
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'IBM Plex Mono', 'Roboto Mono', 'Oxygen Mono', 'Ubuntu Mono', monospace",
            fontLigatures: true,
            lineHeight: 1.5,
            letterSpacing: 0.2,
            minimap: { enabled: false },
            scrollBeyondLastLine: true,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            cursorBlinking: 'phase',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'always',
            bracketPairColorization: { enabled: false },
            guides: {
              bracketPairs: false,
              indentation: false
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
            formatOnType: false,
            renderWhitespace: 'none',
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            },
            selectionHighlight: false,
            occurrencesHighlight: false,
            renderIndentGuides: false
          }}
          loading={
            <div className="editor-loading">
              <span>loading...</span>
            </div>
          }
        />
      </div>
    </div>
  )
}

export default CodeEditor
