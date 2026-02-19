import React, { useState, useMemo } from 'react'

// ============================================
// 类型定义
// ============================================

// 变更类型
export type ChangeType = 'added' | 'modified' | 'deleted' | 'refactor' | 'fix' | 'style' | 'docs'

// 单个文件变更
export interface FileChange {
  path: string
  oldContent?: string
  newContent?: string
  changeType: ChangeType
  hunks: DiffHunk[]
  stats: {
    additions: number
    deletions: number
    changes: number
  }
}

// Diff块
export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

// Diff行
export interface DiffLine {
  type: 'context' | 'add' | 'delete'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

// 语义变更（高级）
export interface SemanticChange {
  type: ChangeType
  description: string
  location: {
    file: string
    startLine: number
    endLine: number
  }
  severity: 'low' | 'medium' | 'high'
  impact?: {
    affectedFunctions: string[]
    affectedModules: string[]
    risk: 'low' | 'medium' | 'high'
  }
}

// 影响分析
export interface ImpactAnalysis {
  risk: 'low' | 'medium' | 'high'
  affectedFiles: number
  affectedModules: string[]
  breakingChanges: string[]
  recommendations: string[]
}

// ============================================
// 工具函数
// ============================================

// 变更类型标签
const changeTypeLabels: Record<ChangeType, string> = {
  added: '新增',
  modified: '修改',
  deleted: '删除',
  refactor: '重构',
  fix: '修复',
  style: '样式',
  docs: '文档'
}

// 变更类型颜色
const changeTypeColors: Record<ChangeType, { bg: string; text: string; border: string }> = {
  added: { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
  modified: { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
  deleted: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  refactor: { bg: '#e0e7ff', text: '#4f46e5', border: '#a5b4fc' },
  fix: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
  style: { bg: '#fce7f3', text: '#db2777', border: '#f9a8d4' },
  docs: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' }
}

// 风险颜色
const riskColors = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444'
}

// ============================================
// 组件：Diff行
// ============================================

interface DiffLineViewProps {
  line: DiffLine
}

const DiffLineView: React.FC<DiffLineViewProps> = ({ line }) => {
  const bgColor = line.type === 'add' 
    ? '#d1fae5' 
    : line.type === 'delete' 
    ? '#fee2e2' 
    : 'transparent'

  const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '

  return (
    <div
      style={{
        display: 'flex',
        fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
        fontSize: '12px',
        lineHeight: '1.5',
        backgroundColor: bgColor,
        padding: '1px 8px'
      }}
    >
      {/* 行号 */}
      <span style={{
        width: '40px',
        textAlign: 'right',
        color: 'var(--text-secondary)',
        marginRight: '8px',
        userSelect: 'none'
      }}>
        {line.oldLineNumber || ''}
      </span>
      <span style={{
        width: '40px',
        textAlign: 'right',
        color: 'var(--text-secondary)',
        marginRight: '8px',
        userSelect: 'none'
      }}>
        {line.newLineNumber || ''}
      </span>
      {/* 内容 */}
      <span style={{
        flex: 1,
        color: line.type === 'add' ? '#059669' : line.type === 'delete' ? '#dc2626' : 'inherit',
        whiteSpace: 'pre'
      }}>
        {prefix} {line.content}
      </span>
    </div>
  )
}

// ============================================
// 组件：Diff文件块
// ============================================

interface DiffFileBlockProps {
  change: FileChange
  expanded?: boolean
  onToggleExpand?: () => void
}

const DiffFileBlock: React.FC<DiffFileBlockProps> = ({
  change,
  expanded = false,
  onToggleExpand
}) => {
  const colors = changeTypeColors[change.changeType]
  const isExpanded = expanded !== undefined ? expanded : false

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        marginBottom: '12px',
        overflow: 'hidden'
      }}
    >
      {/* 文件头部 */}
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: colors.bg,
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 变更类型标签 */}
          <span
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              backgroundColor: colors.text,
              color: '#fff'
            }}
          >
            {changeTypeLabels[change.changeType]}
          </span>
          
          {/* 文件路径 */}
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontFamily: 'monospace'
          }}>
            {change.path}
          </span>
        </div>

        {/* 统计 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#059669' }}>
            +{change.stats.additions}
          </span>
          <span style={{ fontSize: '12px', color: '#dc2626' }}>
            -{change.stats.deletions}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Diff内容 */}
      {isExpanded && change.hunks.length > 0 && (
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {change.hunks.map((hunk, hunkIdx) => (
            <div key={hunkIdx}>
              {/* Hunk头 */}
              <div style={{
                padding: '4px 14px',
                fontSize: '11px',
                fontFamily: 'monospace',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-color)'
              }}>
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </div>
              
              {/* 行内容 */}
              {hunk.lines.map((line, lineIdx) => (
                <DiffLineView key={lineIdx} line={line} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// 组件：语义变更列表
// ============================================

interface SemanticChangeListProps {
  changes: SemanticChange[]
  onChangeClick?: (change: SemanticChange) => void
}

export const SemanticChangeList: React.FC<SemanticChangeListProps> = ({
  changes,
  onChangeClick
}) => {
  const severityOrder = { high: 0, medium: 1, low: 2 }
  const sortedChanges = [...changes].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return (
    <div style={{ padding: '12px' }}>
      {sortedChanges.map((change, idx) => (
        <div
          key={idx}
          onClick={() => onChangeClick?.(change)}
          style={{
            display: 'flex',
            gap: '12px',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '8px',
            backgroundColor: 'var(--bg-secondary)',
            cursor: 'pointer',
            borderLeft: `3px solid ${
              change.severity === 'high' ? '#ef4444' : 
              change.severity === 'medium' ? '#f59e0b' : '#10b981'
            }`
          }}
        >
          {/* 变更类型图标 */}
          <div style={{
            fontSize: '20px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: changeTypeColors[change.type].bg,
            borderRadius: '8px'
          }}>
            {change.type === 'added' ? '✨' :
             change.type === 'fix' ? '🔧' :
             change.type === 'refactor' ? '♻️' :
             change.type === 'style' ? '🎨' :
             change.type === 'docs' ? '📝' : '📝'}
          </div>

          {/* 变更详情 */}
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px'
            }}>
              <span style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: changeTypeColors[change.type].bg,
                color: changeTypeColors[change.type].text,
                fontWeight: 500
              }}>
                {changeTypeLabels[change.type]}
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}>
                {change.description}
              </span>
            </div>
            
            <div style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace'
            }}>
              {change.location.file}:{change.location.startLine}-{change.location.endLine}
            </div>

            {/* 影响范围 */}
            {change.impact && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '6px',
                fontSize: '11px'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  {change.impact.affectedFunctions.length > 0 && (
                    <span>🔧 {change.impact.affectedFunctions.slice(0, 3).join(', ')}
                      {change.impact.affectedFunctions.length > 3 && ` +${change.impact.affectedFunctions.length - 3}`}
                    </span>
                  )}
                  {change.impact.affectedModules.length > 0 && (
                    <span>📦 {change.impact.affectedModules.slice(0, 2).join(', ')}</span>
                  )}
                </div>
                <div style={{
                  marginTop: '4px',
                  color: riskColors[change.impact.risk]
                }}>
                  ⚠️ 风险等级: {change.impact.risk === 'high' ? '高' : change.impact.risk === 'medium' ? '中' : '低'}
                </div>
              </div>
            )}
          </div>

          {/* 严重性指示 */}
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: change.severity === 'high' ? '#ef4444' : 
                           change.severity === 'medium' ? '#f59e0b' : '#10b981',
            flexShrink: 0,
            alignSelf: 'center'
          }} />
        </div>
      ))}

      {changes.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '24px',
          color: 'var(--text-secondary)'
        }}>
          暂无语义变更
        </div>
      )}
    </div>
  )
}

// ============================================
// 组件：影响分析面板
// ============================================

interface ImpactAnalysisPanelProps {
  analysis: ImpactAnalysis
}

export const ImpactAnalysisPanel: React.FC<ImpactAnalysisPanelProps> = ({ analysis }) => {
  return (
    <div style={{
      padding: '16px',
      backgroundColor: analysis.risk === 'high' 
        ? 'rgba(239, 68, 68, 0.08)' 
        : analysis.risk === 'medium'
        ? 'rgba(245, 158, 11, 0.08)'
        : 'rgba(16, 185, 129, 0.08)',
      borderRadius: '12px',
      border: `1px solid ${riskColors[analysis.risk]}30`
    }}>
      {/* 风险等级 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          📊 影响范围分析
        </div>
        <span style={{
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: riskColors[analysis.risk],
          color: '#fff'
        }}>
          {analysis.risk === 'high' ? '🔴 高风险' : 
           analysis.risk === 'medium' ? '🟡 中风险' : '🟢 低风险'}
        </span>
      </div>

      {/* 统计 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '12px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
            {analysis.affectedFiles}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            影响文件
          </div>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '12px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#8b5cf6' }}>
            {analysis.affectedModules.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            影响模块
          </div>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '12px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444' }}>
            {analysis.breakingChanges.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            破坏性变更
          </div>
        </div>
      </div>

      {/* 受影响模块 */}
      {analysis.affectedModules.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px'
          }}>
            📦 受影响的模块
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {analysis.affectedModules.map((mod, idx) => (
              <span
                key={idx}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)'
                }}
              >
                {mod}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 破坏性变更 */}
      {analysis.breakingChanges.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#ef4444',
            marginBottom: '6px'
          }}>
            ⚠️ 破坏性变更
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: '16px',
            fontSize: '12px',
            color: 'var(--text-primary)'
          }}>
            {analysis.breakingChanges.map((change, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{change}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 建议 */}
      {analysis.recommendations.length > 0 && (
        <div>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px'
          }}>
            💡 建议
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: '16px',
            fontSize: '12px',
            color: 'var(--text-primary)'
          }}>
            {analysis.recommendations.map((rec, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ============================================
// 组件：DiffViewer（主组件）
// ============================================

interface DiffViewerProps {
  changes: FileChange[]
  semanticChanges?: SemanticChange[]
  impactAnalysis?: ImpactAnalysis
  viewMode?: 'unified' | 'split' | 'semantic'
  onFileClick?: (change: FileChange) => void
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  changes,
  semanticChanges = [],
  impactAnalysis,
  viewMode = 'unified'
}) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  const toggleFile = (path: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  // 计算总统计
  const totalStats = useMemo(() => {
    return changes.reduce((acc, change) => ({
      additions: acc.additions + change.stats.additions,
      deletions: acc.deletions + change.stats.deletions,
      changes: acc.changes + change.stats.changes
    }), { additions: 0, deletions: 0, changes: 0 })
  }, [changes])

  return (
    <div style={{ padding: '16px' }}>
      {/* 头部统计 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>
          {changes.length} 个文件变更
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          <span style={{ color: '#059669' }}>+{totalStats.additions}</span>
          <span style={{ color: '#dc2626' }}>-{totalStats.deletions}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{totalStats.changes} 处修改</span>
        </div>
      </div>

      {/* 影响分析面板 */}
      {impactAnalysis && (
        <div style={{ marginBottom: '16px' }}>
          <ImpactAnalysisPanel analysis={impactAnalysis} />
        </div>
      )}

      {/* 语义变更视图 */}
      {viewMode === 'semantic' && semanticChanges.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'var(--text-primary)'
          }}>
            🔍 语义变更分析
          </div>
          <SemanticChangeList changes={semanticChanges} />
        </div>
      )}

      {/* 文件Diff列表 */}
      <div>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '8px',
          color: 'var(--text-primary)'
        }}>
          📝 文件变更详情
        </div>
        {changes.map((change, idx) => (
          <DiffFileBlock
            key={idx}
            change={change}
            expanded={expandedFiles.has(change.path)}
            onToggleExpand={() => toggleFile(change.path)}
          />
        ))}
      </div>

      {changes.length === 0 && semanticChanges.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
          <div>暂无变更</div>
        </div>
      )}
    </div>
  )
}

export default DiffViewer
