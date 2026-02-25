import React, { useState } from 'react';
import './SimpleDiffViewer.css';

interface ChangeItem {
  id: string;
  fileName: string;
  oldContent: string;
  newContent: string;
  status: 'added' | 'modified' | 'deleted';
  fileType: string;
}

interface SimpleDiffViewerProps {
  changes: ChangeItem[];
  theme?: 'dark' | 'light';
  currentFileId?: string;
  onFileSelect?: (fileId: string) => void;
}

const SimpleDiffViewer: React.FC<SimpleDiffViewerProps> = ({ 
  changes, 
  theme = 'dark', 
  currentFileId,
  onFileSelect 
}) => {
  const selectedChange = changes.find(change => change.id === currentFileId) || changes[0];
  
  // 简单的行级别差异计算
  const computeDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const diff: Array<{ type: 'added' | 'removed' | 'unchanged', content: string, lineNumber: number }> = [];
    
    // 这是一个简化的差异算法，仅用于演示
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (oldLine !== newLine) {
        if (oldLine === undefined) {
          diff.push({ type: 'added', content: newLine || '', lineNumber: i + 1 });
        } else if (newLine === undefined) {
          diff.push({ type: 'removed', content: oldLine || '', lineNumber: i + 1 });
        } else {
          diff.push({ type: 'removed', content: oldLine, lineNumber: i + 1 });
          diff.push({ type: 'added', content: newLine, lineNumber: i + 1 });
        }
      } else if (oldLine !== undefined && newLine !== undefined) {
        diff.push({ type: 'unchanged', content: oldLine, lineNumber: i + 1 });
      }
    }
    
    return diff;
  };

  const renderDiff = () => {
    if (!selectedChange) return null;

    const { fileName, oldContent, newContent, fileType } = selectedChange;
    const diff = computeDiff(oldContent, newContent);

    return (
      <div className="simple-diff-container">
        <div className="diff-content">
          <table className="diff-table">
            <tbody>
              {diff.map((line, index) => (
                <tr 
                  key={index} 
                  className={`diff-line diff-line-${line.type}`}
                  style={{
                    backgroundColor: 
                      line.type === 'added' ? (theme === 'dark' ? '#1e3a21' : '#e6ffec') :
                      line.type === 'removed' ? (theme === 'dark' ? '#431d1d' : '#ffeef0') :
                      'transparent'
                  }}
                >
                  <td className="line-number old-line">{line.type === 'removed' || line.type === 'unchanged' ? line.lineNumber : ''}</td>
                  <td className="line-number new-line">{line.type === 'added' || line.type === 'unchanged' ? line.lineNumber : ''}</td>
                  <td className="line-content">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    {line.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
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
    <div className={`simple-diff-viewer-container ${theme}`}>
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
      
      <div className="diff-content-panel">
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

export default SimpleDiffViewer;