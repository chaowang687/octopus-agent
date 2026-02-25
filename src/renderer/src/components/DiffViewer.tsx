import React from 'react';
import ReactDiffViewer from 'react-diff-viewer';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 定义 DiffMethod 类型
declare module 'react-diff-viewer' {
  enum DiffMethod {
    WORDS = 'words',
    CHARS = 'chars',
    LINES = 'lines',
  }
}

interface ChangeItem {
  id: string;
  fileName: string;
  oldContent: string;
  newContent: string;
  status: 'added' | 'modified' | 'deleted';
  fileType: string; // 文件扩展名，如 'ts', 'js', 'md', 'json' 等
}

interface DiffViewerProps {
  changes: ChangeItem[];
  theme?: 'dark' | 'light';
  currentFileId?: string;
  onFileSelect?: (fileId: string) => void;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ 
  changes, 
  theme = 'dark', 
  currentFileId,
  onFileSelect 
}) => {
  const selectedChange = changes.find(change => change.id === currentFileId) || changes[0];

  const renderDiff = () => {
    if (!selectedChange) return null;

    const { fileName, oldContent, newContent, fileType } = selectedChange;

    // 根据文件类型选择渲染方式
    if (fileType === 'md' || fileType === 'markdown') {
      // 对于Markdown文件，我们显示渲染后的差异
      return (
        <div className="markdown-diff-container">
          <div className="diff-section">
            <h4>原始内容</h4>
            <div className="markdown-content">
              <ReactMarkdown>{oldContent}</ReactMarkdown>
            </div>
          </div>
          <div className="diff-section">
            <h4>更新后内容</h4>
            <div className="markdown-content">
              <ReactMarkdown>{newContent}</ReactMarkdown>
            </div>
          </div>
        </div>
      );
    } else {
      // 对于代码文件，使用差异查看器
      const reactDiffTheme = theme === 'dark' ? vscDarkPlus : oneLight;
      
      return (
        <ReactDiffViewer
          oldValue={oldContent}
          newValue={newContent}
          splitView={true}
          disableWordDiff={false}
          compareMethod={'chars' as any}
          styles={{
            variables: {
              dark: {
                diffViewerBackground: theme === 'dark' ? '#1e1e1e' : '#fafafa',
                diffViewerColor: theme === 'dark' ? '#d4d4d4' : '#333',
                addedBackground: theme === 'dark' ? '#1e3a21' : '#e6ffec',
                addedColor: theme === 'dark' ? '#85e185' : '#22863a',
                removedBackground: theme === 'dark' ? '#431d1d' : '#ffeef0',
                removedColor: theme === 'dark' ? '#e18585' : '#b31d28',
                wordAddedBackground: theme === 'dark' ? '#1e3a21' : '#e6ffec',
                wordRemovedBackground: theme === 'dark' ? '#431d1d' : '#ffeef0',
                emptyLineBackground: theme === 'dark' ? '#2a2a2a' : '#f8f8f8',
              },
            },
            diffContainer: {
              pre: {
                fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, monospace",
                fontSize: '13px',
                lineHeight: '1.6',
                margin: '0',
              },
            },
          }}
        />
      );
    }
  };

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'added': return 'status-added';
      case 'deleted': return 'status-deleted';
      case 'modified': return 'status-modified';
      default: return 'status-modified';
    }
  };

  return (
    <div className={`diff-viewer-container ${theme}`}>
      <div className="diff-sidebar">
        <h3>变更文件</h3>
        <ul className="file-list">
          {changes.map((change) => (
            <li
              key={change.id}
              className={`file-item ${
                currentFileId === change.id ? 'active' : ''
              } ${getStatusClass(change.status)}`}
              onClick={() => onFileSelect?.(change.id)}
            >
              <span className="file-icon">
                {change.status === 'added' ? '+' : 
                 change.status === 'deleted' ? '-' : '✎'}
              </span>
              <span className="file-name">{change.fileName}</span>
              <span className={`status-badge ${getStatusClass(change.status)}`}>
                {change.status === 'added' ? '新增' : 
                 change.status === 'deleted' ? '删除' : '修改'}
              </span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="diff-content">
        {selectedChange && (
          <div className="diff-header">
            <h3>{selectedChange.fileName}</h3>
            <span className={`status-badge ${getStatusClass(selectedChange.status)}`}>
              {selectedChange.status === 'added' ? '新增' : 
               selectedChange.status === 'deleted' ? '删除' : '修改'}
            </span>
          </div>
        )}
        <div className="diff-comparison">
          {renderDiff()}
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;