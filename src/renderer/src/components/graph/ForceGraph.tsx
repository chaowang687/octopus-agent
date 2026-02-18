import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'

// ============================================
// 类型定义
// ============================================

// 图节点
export interface GraphNode {
  id: string
  label: string
  type: 'file' | 'folder' | 'function' | 'class' | 'module'
  size?: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  metadata?: {
    path?: string
    exports?: string[]
    imports?: number
    lines?: number
    language?: string
  }
}

// 图边
export interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  strength: number
  type: 'import' | 'export' | 'call' | 'inherit' | 'dependency'
}

// 图数据
export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

// 选中节点信息
export interface SelectedNodeInfo {
  node: GraphNode
  connections: {
    incoming: GraphNode[]
    outgoing: GraphNode[]
  }
}

// ============================================
// 工具函数
// ============================================

// 文件类型颜色映射
const fileTypeColors: Record<string, string> = {
  // 前端
  ts: '#3178c6', // TypeScript
  tsx: '#3178c6',
  js: '#f7df1e',
  jsx: '#f7df1e',
  vue: '#42b883',
  svelte: '#ff3e00',
  css: '#264de4',
  scss: '#cf649a',
  less: '#1d365d',
  // 后端
  py: '#3776ab',
  rb: '#cc342d',
  go: '#00add8',
  rs: '#dea584',
  java: '#b07219',
  kt: '#a97bff',
  // 配置
  json: '#292929',
  yaml: '#cb171e',
  yml: '#cb171e',
  toml: '#9c4121',
  // 其他
  md: '#083fa1',
  html: '#e34c26',
  svg: '#ffb13b',
  png: '#89cff0',
  jpg: '#89cff0',
  // 默认
  default: '#6b7280'
}

// 节点类型颜色
const nodeTypeColors: Record<string, string> = {
  file: '#3b82f6',
  folder: '#8b5cf6',
  function: '#10b981',
  class: '#f59e0b',
  module: '#ec4899'
}

// 获取文件扩展名
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'default'
}

// 获取节点颜色
const getNodeColor = (node: GraphNode): string => {
  if (node.type === 'function') return nodeTypeColors.function
  if (node.type === 'class') return nodeTypeColors.class
  if (node.type === 'folder') return nodeTypeColors.folder
  if (node.type === 'module') return nodeTypeColors.module
  
  // 文件类型
  const ext = getFileExtension(node.label)
  return fileTypeColors[ext] || fileTypeColors.default
}

// ============================================
// 组件：图例
// ============================================

interface LegendProps {
  nodeTypes: { type: string; label: string; color: string }[]
}

const Legend: React.FC<LegendProps> = ({ nodeTypes }) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      backgroundColor: 'var(--bg-secondary, #fff)',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid var(--border-color)',
      fontSize: '11px'
    }}>
      <div style={{
        fontWeight: 600,
        marginBottom: '8px',
        color: 'var(--text-secondary)'
      }}>
        图例
      </div>
      {nodeTypes.map(({ type, label, color }) => (
        <div
          key={type}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px'
          }}
        >
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: color
          }} />
          <span style={{ color: 'var(--text-primary)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================
// 组件：节点提示
// ============================================

interface NodeTooltipProps {
  node: GraphNode
  x: number
  y: number
  connections: { incoming: number; outgoing: number }
}

const NodeTooltip: React.FC<NodeTooltipProps> = ({ node, x, y, connections }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x + 15,
        top: y - 10,
        backgroundColor: 'var(--bg-secondary, #fff)',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        border: '1px solid var(--border-color)',
        minWidth: '180px',
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getNodeColor(node)
        }} />
        {node.label}
      </div>
      
      {node.metadata?.path && (
        <div style={{
          fontSize: '11px',
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
          wordBreak: 'break-all'
        }}>
          {node.metadata.path}
        </div>
      )}
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px',
        fontSize: '11px'
      }}>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>类型: </span>
          <span>{node.type}</span>
        </div>
        {node.metadata?.lines && (
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>行数: </span>
            <span>{node.metadata.lines}</span>
          </div>
        )}
<div>
          <span style={{ color: 'var(--text-secondary)' }}>引入: </span>
          <span>{connections.incoming}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>导出: </span>
          <span>{connections.outgoing}</span>
        </div>
      </div>
      
      {node.metadata?.exports && node.metadata.exports.length > 0 && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-secondary)',
            marginBottom: '4px'
          }}>
            导出:
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px'
          }}>
            {node.metadata.exports.slice(0, 5).map((exp, idx) => (
              <span
                key={idx}
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                  fontFamily: 'monospace'
                }}
              >
                {exp}
              </span>
            ))}
            {node.metadata.exports.length > 5 && (
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                +{node.metadata.exports.length - 5}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// 组件：ForceGraph（力导向图）
// ============================================

interface ForceGraphProps {
  data: GraphData
  width?: number
  height?: number
  onNodeClick?: (node: GraphNode, connections: { incoming: GraphNode[], outgoing: GraphNode[] }) => void
  highlightedNodes?: string[]
  showLegend?: boolean
}

export const ForceGraph:React.FC<ForceGraphProps> = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  highlightedNodes = [],
  showLegend = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>(data.nodes.map(n => ({ ...n })))
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [dimensions, setDimensions] = useState({ width, height })
  const simulationRef = useRef<any>(null)

  // 容器尺寸
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDimensions({ width: rect.width, height: rect.height })
    }
  }, [width, height])

  // 力导向模拟
  useEffect(() => {
    if (!dimensions.width || !dimensions.height || nodes.length === 0) return

    // 简单的力导向模拟
    const alpha = 0.3
    const alphaDecay = 0.02
    const velocityDecay = 0.4

    // 初始化位置（随机分布）
    const initializedNodes = nodes.map(node => ({
      ...node,
      x: node.x ?? Math.random() * dimensions.width,
      y: node.y ?? Math.random() * dimensions.height
    }))

    // 创建节点索引
    const nodeMap = new Map(initializedNodes.map(n => [n.id, n]))

    // 计算度数
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()
    
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      outDegree.set(sourceId, (outDegree.get(sourceId) || 0) + 1)
      inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1)
    })

    // 设置节点大小
    initializedNodes.forEach(node => {
      const degree = (inDegree.get(node.id) || 0) + (outDegree.get(node.id) || 0)
      node.size = Math.max(6, Math.min(20, 6 + degree * 1.5))
    })

    // 模拟函数
    const simulate = () => {
      const k = Math.sqrt((dimensions.width * dimensions.height) / initializedNodes.length)
      
      // 库仑力（排斥）
      for (let i = 0; i < initializedNodes.length; i++) {
        for (let j = i + 1; j < initializedNodes.length; j++) {
          const a = initializedNodes[i]
          const b = initializedNodes[j]
          const dx = (b.x || 0) - (a.x || 0)
          const dy = (b.y || 0) - (a.y || 0)
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
          const force = (k * k) / dist
          const fx = (dx / dist) * force * 0.1
          const fy = (dy / dist) * force * 0.1
          
          if (a.fx === null) (a as any).vx = ((a as any).vx || 0) - fx
          if (b.fx === null) (b as any).vx = ((b as any).vx || 0) + fx
          if (a.fy === null) (a as any).vy = ((a as any).vy || 0) - fy
          if (b.fy === null) (b as any).vy = ((b as any).vy || 0) + fy
        }
      }

      // 胡克定律（吸引）- 通过边连接
      data.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id
        const targetId = typeof link.target === 'string' ? link.target : link.target.id
        const source = nodeMap.get(sourceId)
        const target = nodeMap.get(targetId)
        
        if (source && target) {
          const dx = (target.x || 0) - (source.x || 0)
          const dy = (target.y || 0) - (source.y || 0)
          const dist = Math.sqrt(dx * dx + dy * dy)
          const force = (dist - k * 0.5) * link.strength * 0.05
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          
          if (source.fx === null) (source as any).vx = ((source as any).vx || 0) + fx
          if (target.fx === null) (target as any).vx = ((target as any).vx || 0) - fx
          if (source.fy === null) (source as any).vy = ((source as any).vy || 0) + fy
          if (target.fy === null) (target as any).vy = ((target as any).vy || 0) - fy
        }
      })

      // 中心力
      initializedNodes.forEach((node: any) => {
        if (node.fx === null) {
          const dx = dimensions.width / 2 - (node.x || 0)
          const dy = dimensions.height / 2 - (node.y || 0)
          node.vx = (node.vx || 0) + dx * 0.01
        }
        if (node.fy === null) {
          const dx = dimensions.width / 2 - (node.x || 0)
          const dy = dimensions.height / 2 - (node.y || 0)
          node.vy = (node.vy || 0) + dy * 0.01
        }
      })

      // 更新位置
      initializedNodes.forEach(node => {
        if (node.fx === null) {
          (node as any).vx = ((node as any).vx || 0) * (1 - velocityDecay)
          node.x = (node.x || 0) + ((node as any).vx || 0) * alpha
        }
        if (node.fy === null) {
          (node as any).vy = ((node as any).vy || 0) * (1 - velocityDecay)
          node.y = (node.y || 0) + ((node as any).vy || 0) * alpha
        }
        
        // 边界约束
        node.x = Math.max(20, Math.min(dimensions.width - 20, node.x || 0))
        node.y = Math.max(20, Math.min(dimensions.height - 20, node.y || 0))
      })

      setNodes([...initializedNodes])
    }

    // 运行模拟
    const interval = setInterval(simulate, 50)
    
    // 几秒后停止
    setTimeout(() => {
      clearInterval(interval)
    }, 2000)

    return () => clearInterval(interval)
  }, [data, dimensions])

  // 获取选中节点的连接信息
  const getNodeConnections = useCallback((node: GraphNode) => {
    const incoming: GraphNode[] = []
    const outgoing: GraphNode[] = []
    
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      
      if (targetId === node.id) {
        const sourceNode = nodes.find(n => n.id === sourceId)
        if (sourceNode) incoming.push(sourceNode)
      }
      if (sourceId === node.id) {
        const targetNode = nodes.find(n => n.id === targetId)
        if (targetNode) outgoing.push(targetNode)
      }
    })
    
    return { incoming, outgoing }
  }, [data.links, nodes])

  // 处理节点点击
  const handleNodeClick = (node: GraphNode, event: React.MouseEvent) => {
    event.stopPropagation()
    const connections = getNodeConnections(node)
    setSelectedNode(node)
    onNodeClick?.(node, connections)
  }

  // 处理节点悬停
  const handleNodeHover = (node: GraphNode | null, event?: React.MouseEvent) => {
    if (node && event) {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        setTooltipPos({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        })
      }
    }
    setHoveredNode(node)
  }

  // 获取连接数
  const getConnectionCounts = (nodeId: string) => {
    let incoming = 0
    let outgoing = 0
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      if (targetId === nodeId) incoming++
      if (sourceId === nodeId) outgoing++
    })
    return { incoming, outgoing }
  }

  // 节点类型图例
  const legendItems = [
    { type: 'file', label: '文件', color: nodeTypeColors.file },
    { type: 'folder', label: '文件夹', color: nodeTypeColors.folder },
    { type: 'function', label: '函数', color: nodeTypeColors.function },
    { type: 'class', label: '类', color: nodeTypeColors.class },
    { type: 'module', label: '模块', color: nodeTypeColors.module }
  ]

  // 过滤显示的节点（如果高亮节点有值）
  const visibleNodes = highlightedNodes.length > 0 
    ? nodes.filter(n => highlightedNodes.includes(n.id))
    : nodes

  const visibleNodeIds = new Set(visibleNodes.map(n => n.id))
  const visibleLinks = data.links.filter(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id
    const targetId = typeof link.target === 'string' ? link.target : link.target.id
    return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)
  })

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        position: 'relative',
        backgroundColor: 'var(--bg-secondary, #f9fafb)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block' }}
        onClick={() => setSelectedNode(null)}
      >
        {/* 边 */}
        <g>
          {visibleLinks.map((link, idx) => {
            const sourceNode = typeof link.source === 'string' 
              ? nodes.find(n => n.id === link.source)
              : link.source
            const targetNode = typeof link.target === 'string'
              ? nodes.find(n => n.id === link.target)
              : link.target
            
            if (!sourceNode || !targetNode) return null
            
            const isHighlighted = highlightedNodes.length > 0 && 
              (highlightedNodes.includes(sourceNode.id) || highlightedNodes.includes(targetNode.id))
            
            return (
              <line
                key={idx}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={isHighlighted ? '#3b82f6' : '#d1d5db'}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeOpacity={isHighlighted ? 0.8 : 0.4}
              />
            )
          })}
        </g>

        {/* 节点 */}
        <g>
          {visibleNodes.map((node) => {
            const isHighlighted = highlightedNodes.length === 0 || highlightedNodes.includes(node.id)
            const isSelected = selectedNode?.id === node.id
            const connCounts = getConnectionCounts(node.id)
            const nodeSize = node.size || 8
            
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ 
                  cursor: 'pointer',
                  opacity: isHighlighted ? 1 : 0.3,
                  transition: 'opacity 0.2s ease'
                }}
                onClick={(e) => handleNodeClick(node, e)}
                onMouseEnter={(e) => handleNodeHover(node, e)}
                onMouseLeave={() => handleNodeHover(null)}
              >
                {/* 外圈（选中状态） */}
                {isSelected && (
                  <circle
                    r={nodeSize + 6}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                )}
                
                {/* 主节点 */}
                <circle
                  r={nodeSize}
                  fill={getNodeColor(node)}
                  stroke="#fff"
                  strokeWidth={2}
                  style={{
                    filter: isSelected ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))' : 'none'
                  }}
                />
                
                {/* 连接数指示 */}
                {(connCounts.incoming > 0 || connCounts.outgoing > 0) && (
                  <circle
                    r={4}
                    fill="#fff"
                    stroke={getNodeColor(node)}
                    strokeWidth={1}
                    cx={nodeSize * 0.7}
                    cy={-nodeSize * 0.7}
                  />
                )}
                
                {/* 标签 */}
                {nodeSize >= 10 && (
                  <text
                    y={nodeSize + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--text-primary)"
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label.length > 15 ? node.label.slice(0, 12) + '...' : node.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* 提示框 */}
      {hoveredNode && (
        <NodeTooltip
          node={hoveredNode}
          x={tooltipPos.x}
          y={tooltipPos.y}
          connections={getConnectionCounts(hoveredNode.id)}
        />
      )}

      {/* 图例 */}
      {showLegend && <Legend nodeTypes={legendItems} />}

      {/* 选中节点信息 */}
      {selectedNode && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            backgroundColor: 'var(--bg-secondary, #fff)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid var(--border-color)',
            maxWidth: '240px'
          }}
        >
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: getNodeColor(selectedNode)
            }} />
            {selectedNode.label}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>类型: {selectedNode.type}</div>
            {selectedNode.metadata?.path && (
              <div style={{ 
                wordBreak: 'break-all', 
                marginTop: '4px',
                fontFamily: 'monospace' 
              }}>
                {selectedNode.metadata.path}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {data.nodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🕸️</div>
          <div>暂无依赖数据</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            执行任务后会自动分析依赖关系
          </div>
        </div>
      )}
    </div>
  )
}

export default ForceGraph
