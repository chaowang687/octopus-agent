import React, { useState, useRef, useEffect } from 'react';
import './ModernDiffViewer.css';

interface ChangeItem {
  id: string;
  fileName: string;
  oldContent: string;
  newContent: string;
  status: 'added' | 'modified' | 'deleted';
  fileType: string;
  additions?: number;
  deletions?: number;
}

interface ModernDiffViewerProps {
  changes: ChangeItem[];
  theme?: 'dark' | 'light';
  currentFileId?: string;
  onFileSelect?: (fileId: string) => void;
}

const ModernDiffViewer: React.FC<ModernDiffViewerProps> = ({ 
  changes, 
  theme = 'dark', 
  currentFileId,
  onFileSelect 
}) => {
  const selectedChange = changes.find(change => change.id === currentFileId) || changes[0];
  const [splitPosition, setSplitPosition] = useState(50); // 50% 分割点
  const splitRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  
  // 计算变更统计
  const calculateStats = (oldContent: string, newContent: string) => {
    const oldLines = oldContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const additions = newLines > oldLines ? newLines - oldLines : 0;
    const deletions = oldLines > newLines ? oldLines - newLines : 0;
    return { additions, deletions };
  };
  
  // 简单的行级别差异计算
  const computeDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const diff: Array<{ type: 'added' | 'removed' | 'unchanged', content: string, oldLineNumber?: number, newLineNumber?: number }> = [];
    
    let oldIndex = 0;
    let newIndex = 0;
    
    // 简化的差异算法
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex];
      const newLine = newLines[newIndex];
      
      if (oldLine === undefined) {
        // 新增行
        diff.push({ 
          type: 'added', 
          content: newLine || '', 
          newLineNumber: newIndex + 1 
        });
        newIndex++;
      } else if (newLine === undefined) {
        // 删除行
        diff.push({ 
          type: 'removed', 
          content: oldLine || '', 
          oldLineNumber: oldIndex + 1 
        });
        oldIndex++;
      } else if (oldLine === newLine) {
        // 未变更行
        diff.push({ 
          type: 'unchanged', 
          content: oldLine, 
          oldLineNumber: oldIndex + 1, 
          newLineNumber: newIndex + 1 
        });
        oldIndex++;
        newIndex++;
      } else {
        // 变更行
        diff.push({ 
          type: 'removed', 
          content: oldLine, 
          oldLineNumber: oldIndex + 1 
        });
        diff.push({ 
          type: 'added', 
          content: newLine, 
          newLineNumber: newIndex + 1 
        });
        oldIndex++;
        newIndex++;
      }
    }
    
    return diff;
  };

  // 处理拖动事件
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingRef.current && splitRef.current && splitRef.current.parentElement) {
      const parentRect = splitRef.current.parentElement.getBoundingClientRect();
      const newPosition = ((e.clientX - parentRect.left) / parentRect.width) * 100;
      if (newPosition > 20 && newPosition < 80) { // 限制拖动范围
        setSplitPosition(newPosition);
      }
    }
  };
  
  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };
  
  // 添加全局鼠标事件监听
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const renderDiff = () => {
    if (!selectedChange) return null;

    const { fileName, oldContent, newContent, fileType } = selectedChange;
    const diff = computeDiff(oldContent, newContent);

    return (
      <div className="modern-diff-container">
        <div className="diff-panel old-panel" style={{ width: `${splitPosition}%` }}>
          <div className="panel-header">
            <span>原始</span>
          </div>
          <div className="diff-content">
            {diff.map((line, index) => (
              <div 
                key={`old-${index}`} 
                className={`diff-line diff-line-${line.type} old-line`}
                style={{
                  display: line.type === 'added' ? 'none' : 'flex',
                  backgroundColor: line.type === 'removed' ? (theme === 'dark' ? 'rgba(225, 64, 64, 0.2)' : 'rgba(255, 220, 220, 0.8)') : 'transparent'
                }}
              >
                <div className="line-number">{line.oldLineNumber || ''}</div>
                <div className="line-content">
                  {line.type === 'removed' && <span className="diff-marker">-</span>}
                  {line.content}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div 
          className="diff-splitter" 
          ref={splitRef}
          onMouseDown={handleMouseDown}
        >
          <div className="splitter-handle"></div>
        </div>
        
        <div className="diff-panel new-panel" style={{ width: `${100 - splitPosition}%` }}>
          <div className="panel-header">
            <span>修改后</span>
          </div>
          <div className="diff-content">
            {diff.map((line, index) => (
              <div 
                key={`new-${index}`} 
                className={`diff-line diff-line-${line.type} new-line`}
                style={{
                  display: line.type === 'removed' ? 'none' : 'flex',
                  backgroundColor: line.type === 'added' ? (theme === 'dark' ? 'rgba(82, 196, 26, 0.2)' : 'rgba(220, 255, 220, 0.8)') : 'transparent'
                }}
              >
                <div className="line-number">{line.newLineNumber || ''}</div>
                <div className="line-content">
                  {line.type === 'added' && <span className="diff-marker">+</span>}
                  {line.content}
                </div>
              </div>
            ))}
          </div>
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
    <div className={`modern-diff-viewer-container ${theme}`}>
      <div className="diff-sidebar">
        <div className="sidebar-header">
          <h3>变更文件</h3>
          <div className="change-summary">
            {(() => {
              const totalChanges = changes.reduce((acc, change) => {
                const stats = calculateStats(change.oldContent, change.newContent);
                acc.additions += stats.additions;
                acc.deletions += stats.deletions;
                return acc;
              }, { additions: 0, deletions: 0 });
              
              return (
                <div className="summary-stats">
                  <span className="stat-item additions">+{totalChanges.additions}</span>
                  <span className="stat-item deletions">-{totalChanges.deletions}</span>
                </div>
              );
            })()}
          </div>
        </div>
        <ul className="file-list">
          {changes.map((change) => {
            const stats = calculateStats(change.oldContent, change.newContent);
            return (
              <li
                key={change.id}
                className={`file-item ${currentFileId === change.id ? 'active' : ''} ${getStatusClass(change.status)}`}
                onClick={() => onFileSelect?.(change.id)}
              >
                <span className="file-icon">
                  {change.status === 'added' ? '+' : 
                   change.status === 'deleted' ? '-' : '✎'}
                </span>
                <span className="file-name">{change.fileName}</span>
                <div className="file-stats">
                  <span className="stat-item additions">+{stats.additions}</span>
                  <span className="stat-item deletions">-{stats.deletions}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      
      <div className="diff-content-panel">
        {selectedChange && (
          <div className="diff-header">
            <div className="header-left">
              <h3>{selectedChange.fileName}</h3>
              <span className={`status-badge ${getStatusClass(selectedChange.status)}`}>
                {selectedChange.status === 'added' ? '新增' : 
                 selectedChange.status === 'deleted' ? '删除' : '修改'}
              </span>
            </div>
            <div className="header-right">
              {(() => {
                const stats = calculateStats(selectedChange.oldContent, selectedChange.newContent);
                return (
                  <div className="file-stats">
                    <span className="stat-item additions">+{stats.additions}</span>
                    <span className="stat-item deletions">-{stats.deletions}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        <div className="diff-comparison">
          {renderDiff()}
        </div>
      </div>
    </div>
  );
};

export default ModernDiffViewer;