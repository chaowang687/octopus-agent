import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  ReactFlowInstance,
  Handle,
  Position,
  MarkerType,
  NodeMouseHandler,
  ConnectionMode,
} from 'reactflow'
import 'reactflow/dist/style.css'

// 自定义样式
const customStyles = `
  .react-flow__handle {
    transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  }
  
  .react-flow__handle:hover {
    transform: scale(1.3);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(59, 130, 246, 0.4) !important;
    background-color: #dbeafe !important;
  }
  
  .react-flow__handle:active {
    transform: scale(1.15);
  }
  
  .react-flow__edge-path {
    transition: stroke-width 0.15s ease, stroke 0.15s ease;
  }
  
  .react-flow__edge:hover .react-flow__edge-path {
    stroke-width: 4;
    stroke: #1d4ed8;
  }
  
  .react-flow__edge.selected .react-flow__edge-path {
    stroke-width: 4;
    stroke: #ef4444;
  }
  
  .react-flow__connection-path {
    stroke: #3b82f6 !important;
    stroke-width: 3 !important;
  }
  
  .react-flow__connection-line {
    stroke: #3b82f6 !important;
    stroke-width: 3 !important;
  }
`

// 节点类型定义
type CustomNodeType = 'marketResearch' | 'productManager' | 'uiDesigner' | 'architect' | 'frontendEngineer' | 'backendEngineer' | 'uiTester' | 'functionalTester' | 'boxNode' | 'prompt'

// 内容物类型
type ContentType = 'productDoc' | 'designDoc' | 'uiInterface' | 'codeFile' | 'projectSpec'

// 内容物项接口
interface ContentItem {
  id: string
  type: ContentType
  label: string
  path?: string
}

// 自定义节点数据接口
interface CustomNodeData {
  label: string
  type: CustomNodeType
  input?: string
  output?: string
  path?: string
  // 框节点专用
  inputContent?: ContentItem[]
  outputContent?: ContentItem[]
  uiDoc?: string
  architectDoc?: string
  frontendDoc?: string
  backendDoc?: string
  qaDoc?: string
  outputDir?: string
  // 智能体节点专用
  incomingContent?: {
    docType: string
    docLabel: string
    status: 'waiting' | 'received'
  }[]
}

// 节点模板
const nodeTemplates = [
  { type: 'marketResearch' as const, label: '市场调研', color: '#3b82f6' },
  { type: 'productManager' as const, label: '产品经理', color: '#8b5cf6' },
  { type: 'uiDesigner' as const, label: 'UI设计师', color: '#ec4899' },
  { type: 'architect' as const, label: '架构师', color: '#10b981' },
  { type: 'frontendEngineer' as const, label: '前端工程师', color: '#06b6d4' },
  { type: 'backendEngineer' as const, label: '后端工程师', color: '#14b8a6' },
  { type: 'uiTester' as const, label: 'UI测试工程师', color: '#f59e0b' },
  { type: 'functionalTester' as const, label: '功能测试工程师', color: '#d97706' },
  { type: 'boxNode' as const, label: '📦 框智能体', color: '#64748b' },
  { type: 'prompt' as const, label: '💬 Prompt节点', color: '#f43f5e' },
]

// 自定义节点组件
const CustomNode = ({ data, selected, onOutputDocClick, onAutoConnect, connectedOutputs }: { 
  data: CustomNodeData
  selected?: boolean
  onOutputDocClick?: (docKey: string, docLabel: string, docContent: string) => void
  onAutoConnect?: (docKey: string, nodePosition: { x: number, y: number }) => void
  connectedOutputs?: string[]
}) => {
  const getColor = (type: string) => {
    const template = nodeTemplates.find(t => t.type === type)
    return template?.color || '#2563eb'
  }

  const getContentIcon = (type: ContentType) => {
    switch (type) {
      case 'productDoc': return '📄'
      case 'designDoc': return '🎨'
      case 'uiInterface': return '🖼️'
      case 'codeFile': return '💻'
      case 'projectSpec': return '📋'
      default: return '📁'
    }
  }

  const isBoxNode = data.type === 'boxNode'

  const handleContentItemClick = (e: React.MouseEvent, item: ContentItem) => {
    e.stopPropagation()
    if (item.path) {
      window.electron.agent.openFile(item.path)
    }
  }

  const isPromptNode = data.type === 'prompt'

  if (isPromptNode) {
    return (
      <div style={{
        position: 'relative',
        padding: '16px 24px',
        borderRadius: '10px',
        backgroundColor: getColor(data.type),
        color: 'white',
        fontSize: '15px',
        fontWeight: '600',
        boxShadow: selected ? '0 0 0 3px #60a5fa, 0 4px 12px rgba(0,0,0,0.2)' : '0 3px 10px rgba(0,0,0,0.18)',
        cursor: 'move',
        userSelect: 'none',
        minWidth: '160px',
        textAlign: 'center',
        transition: 'box-shadow 0.2s ease, transform 0.1s ease',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
      }}>
        <Handle 
          type="target" 
          position={Position.Left} 
          isConnectable
          isConnectableEnd
          style={{ 
            width: '22px', 
            height: '22px', 
            backgroundColor: '#fff',
            border: '4px solid #2563eb',
            left: '-11px',
            zIndex: 20,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
          }} 
        />
        <div style={{ 
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          💬 {data.label}
          {data.input && (
            <div style={{
              marginTop: '8px',
              fontSize: '11px',
              opacity: 0.9,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              width: '100%'
            }}>
              <div style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '4px',
                fontSize: '10px',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {data.input.length > 20 ? data.input.substring(0, 20) + '...' : data.input}
              </div>
            </div>
          )}
        </div>
        <Handle 
          type="source" 
          position={Position.Right} 
          isConnectable
          isConnectableStart
          style={{ 
            width: '22px', 
            height: '22px', 
            backgroundColor: '#fff',
            border: '4px solid #2563eb',
            right: '-11px',
            zIndex: 20,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
          }} 
        />
      </div>
    )
  }

  if (isBoxNode) {
    // 定义输出文档配置
    const outputDocs = [
      { key: 'uiDoc', label: 'UI设计文档', color: '#ec4899', icon: '🎨' },
      { key: 'architectDoc', label: '架构设计文档', color: '#10b981', icon: '🏗️' },
      { key: 'frontendDoc', label: '前端开发文档', color: '#06b6d4', icon: '💻' },
      { key: 'backendDoc', label: '后端开发文档', color: '#14b8a6', icon: '🔧' },
      { key: 'qaDoc', label: '测试用例文档', color: '#f59e0b', icon: '🧪' }
    ]

    // 处理输出文档点击
    const handleOutputDocClickInternal = (e: React.MouseEvent, docKey: string, docLabel: string) => {
      e.stopPropagation()
      const docContent = data[docKey as keyof CustomNodeData] as string
      if (!docContent) {
        return
      }
      
      if (onOutputDocClick) {
        onOutputDocClick(docKey, docLabel, docContent)
      }
    }

    return (
      <div style={{
        position: 'relative',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '3px solid ' + getColor(data.type),
        boxShadow: selected ? '0 0 0 3px #60a5fa, 0 8px 24px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.1)',
        cursor: 'move',
        userSelect: 'none',
        minWidth: '420px',
        minHeight: '380px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease, transform 0.1s ease',
        transform: selected ? 'scale(1.01)' : 'scale(1)',
      }}>
        <Handle 
          type="target" 
          position={Position.Left} 
          isConnectable
          isConnectableEnd
          style={{ 
            width: '22px', 
            height: '22px', 
            backgroundColor: '#fff',
            border: '4px solid #2563eb',
            left: '-11px',
            top: '50%',
            zIndex: 20,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
          }} 
        />

        {/* 标题栏 */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: getColor(data.type),
          color: 'white',
          fontWeight: '600',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            📦 {data.label}
          </div>
        </div>

        {/* 输入区 */}
        <div style={{
          padding: '12px 14px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#fef3c7'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#92400e',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            📥 输入内容物
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(data.inputContent || []).map((item) => (
              <div
                key={item.id}
                onClick={(e) => handleContentItemClick(e, item)}
                style={{
                  padding: '5px 9px',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: item.path ? 'pointer' : 'default',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  border: '1px solid #fcd34d'
                }}
              >
                {getContentIcon(item.type)} {item.label.length > 12 ? item.label.substring(0, 12) + '...' : item.label}
                {item.path && <span style={{ fontSize: '10px' }}>🔗</span>}
              </div>
            ))}
            {(!data.inputContent || data.inputContent.length === 0) && (
              <span style={{ fontSize: '10px', color: '#9ca3af' }}>双击配置添加</span>
            )}
          </div>
        </div>

        {/* 中间处理区 */}
        <div style={{
          flex: 1,
          padding: '12px',
          backgroundColor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            ⚙️ 领域适配层
          </span>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>
            将输入转化为专业文档
          </span>
        </div>

        {/* 输出区 */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#d1fae5'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#065f46',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            📤 输出内容物
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {outputDocs.map((doc) => {
              const hasContent = !!data[doc.key as keyof CustomNodeData]
              const isConnected = connectedOutputs?.includes(doc.key)
              return (
                <div
                  key={doc.key}
                  onClick={(e) => handleOutputDocClickInternal(e, doc.key, doc.label)}
                  style={{
                    padding: '5px 9px',
                    backgroundColor: isConnected ? doc.color + '20' : (hasContent ? '#fff' : '#e5e7eb'),
                    borderRadius: '6px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: hasContent ? 'pointer' : 'default',
                    boxShadow: hasContent ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    border: `2px solid ${isConnected ? doc.color : (hasContent ? doc.color : '#d1d5db')}`,
                    opacity: hasContent ? 1 : 0.5,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{doc.icon}</span>
                  <span>{doc.label}</span>
                  {isConnected && <span style={{ fontSize: '10px' }}>🔗</span>}
                  {hasContent && !isConnected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onAutoConnect) {
                          onAutoConnect(doc.key, { x: 0, y: 0 })
                        }
                      }}
                      style={{
                        marginLeft: '4px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        backgroundColor: doc.color,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="自动连接到对应智能体"
                    >
                      ➕
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 多输出端口 */}
        {outputDocs.map((doc, index) => (
          <Handle
            key={doc.key}
            type="source"
            position={Position.Right}
            id={doc.key}
            isConnectable
            isConnectableStart
            style={{
              width: '18px',
              height: '18px',
              backgroundColor: '#fff',
              border: `3px solid ${doc.color}`,
              right: '-9px',
              top: `${15 + index * 18}%`,
              zIndex: 20,
              boxShadow: `0 2px 6px ${doc.color}40`,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div 
      style={{
        position: 'relative',
        padding: '14px 24px',
        borderRadius: '10px',
        backgroundColor: getColor(data.type),
        color: 'white',
        fontSize: '15px',
        fontWeight: '600',
        boxShadow: selected ? '0 0 0 3px #60a5fa, 0 4px 12px rgba(0,0,0,0.2)' : '0 3px 10px rgba(0,0,0,0.18)',
        cursor: 'move',
        userSelect: 'none',
        minWidth: '140px',
        textAlign: 'center',
        transition: 'box-shadow 0.2s ease, transform 0.1s ease',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
      }}>
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable
        isConnectableEnd
        style={{ 
          width: '22px', 
          height: '22px', 
          backgroundColor: '#fff',
          border: '4px solid #2563eb',
          left: '-11px',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
        }} 
      />
      <div style={{ 
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        {data.label}
        
        {/* 智能体节点的内容物状态显示 */}
        {data.incomingContent && data.incomingContent.length > 0 && (
          <div style={{
            marginTop: '8px',
            fontSize: '11px',
            opacity: 0.9,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            width: '100%'
          }}>
            {data.incomingContent.map((content, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '4px',
                width: '100%'
              }}>
                <span style={{ fontSize: '10px' }}>
                  {content.status === 'waiting' ? '⏳' : '✅'}
                </span>
                <span style={{ flex: 1, textAlign: 'left' }}>{content.docLabel}</span>
                <span style={{
                  fontSize: '9px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: content.status === 'waiting' 
                    ? 'rgba(255,255,255,0.3)' 
                    : 'rgba(16,185,129,0.8)',
                  color: 'white'
                }}>
                  {content.status === 'waiting' ? '等待' : '已收'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable
        isConnectableStart
        style={{ 
          width: '22px', 
          height: '22px', 
          backgroundColor: '#fff',
          border: '4px solid #2563eb',
          right: '-11px',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
        }} 
      />
    </div>
  )
}

// 节点类型映射（在主组件内部定义）

// 内部组件 - 包含ReactFlow
const WorkflowDesignerInner = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node<CustomNodeData> | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    nodeId: string
  } | null>(null)
  const [docViewer, setDocViewer] = useState<{
    open: boolean
    title: string
    content: string
  }>({ open: false, title: '', content: '' })
  const [logs, setLogs] = useState<Array<{type: 'info' | 'success' | 'error', message: string, timestamp: number}>>([])

  // 侧边栏折叠状态
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)

  // 监听edges变化，更新智能体节点的内容物状态
  useEffect(() => {
    // 文档类型映射
    const docTypeMap: Record<string, string> = {
      uiDoc: '🎨 UI设计文档',
      architectDoc: '🏗️ 架构设计文档', 
      frontendDoc: '💻 前端开发文档',
      backendDoc: '🔧 后端开发文档',
      qaDoc: '🧪 测试用例文档'
    }
    
    // 为每个智能体节点更新内容物状态
    const updatedNodes = nodes.map(node => {
      if (node.data.type === 'boxNode') return node
      
      // 查找连接到该智能体的框节点输出
      const incomingEdges = edges.filter(e => e.target === node.id && e.sourceHandle)
      
      const incomingContent = incomingEdges.map(edge => {
        const docType = edge.sourceHandle as string
        const docLabel = docTypeMap[docType] || docType
        
        return {
          docType: docType,
          docLabel: docLabel,
          status: 'waiting' as const
        }
      })
      
      return {
        ...node,
        data: {
          ...node.data,
          incomingContent: incomingContent.length > 0 ? incomingContent : undefined
        }
      }
    })
    
    setNodes(updatedNodes)
  }, [edges, nodes, setNodes])

  // 处理输出文档点击
  const handleOutputDocClick = useCallback((docKey: string, docLabel: string, docContent: string) => {
    setDocViewer({
      open: true,
      title: docLabel,
      content: docContent
    })
  }, [])

  // 添加日志
  const addLog = (type: 'info' | 'success' | 'error', message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }])
  }

  // 处理自动连接
  const handleAutoConnect = useCallback((docKey: string, nodePosition: { x: number, y: number }) => {
    // 文档类型到智能体类型的映射
    const docToAgentMap: Record<string, { type: string; label: string; color: string }> = {
      uiDoc: { type: 'uiDesigner', label: 'UI设计师', color: '#ec4899' },
      architectDoc: { type: 'architect', label: '架构师', color: '#10b981' },
      frontendDoc: { type: 'frontendEngineer', label: '前端工程师', color: '#06b6d4' },
      backendDoc: { type: 'backendEngineer', label: '后端工程师', color: '#14b8a6' },
      qaDoc: { type: 'functionalTester', label: '功能测试工程师', color: '#d97706' }
    }

    const agentConfig = docToAgentMap[docKey]
    if (!agentConfig) return

    // 找到框节点的位置
    const boxNode = nodes.find(n => n.data.type === 'boxNode')
    if (!boxNode) return

    // 创建新的智能体节点，放在框节点右侧
    const newNodeId = `node_${Date.now()}`
    const newNode: Node<CustomNodeData> = {
      id: newNodeId,
      type: agentConfig.type,
      position: {
        x: boxNode.position.x + 450,
        y: boxNode.position.y + (Object.keys(docToAgentMap).indexOf(docKey) * 80)
      },
      data: {
        label: agentConfig.label,
        type: agentConfig.type as any
      }
    }

    // 创建连线
    const newEdge: Edge = {
      id: `edge_${Date.now()}`,
      source: boxNode.id,
      target: newNodeId,
      sourceHandle: docKey,
      targetHandle: undefined,
      animated: true,
      style: { stroke: agentConfig.color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: agentConfig.color }
    }

    setNodes(prev => [...prev, newNode])
    setEdges(prev => [...prev, newEdge])
    console.log(`已自动创建${agentConfig.label}节点并连接`)
  }, [nodes, setNodes, setEdges])

  // 节点类型映射
  const nodeTypes = useMemo(() => ({
    marketResearch: CustomNode,
    productManager: CustomNode,
    uiDesigner: CustomNode,
    architect: CustomNode,
    frontendEngineer: CustomNode,
    backendEngineer: CustomNode,
    uiTester: CustomNode,
    functionalTester: CustomNode,
    boxNode: (props: any) => {
      const boxNodeId = props.id
      const connectedOutputs = edges
        .filter(e => e.source === boxNodeId && e.sourceHandle)
        .map(e => e.sourceHandle as string)
      return <CustomNode {...props} onOutputDocClick={handleOutputDocClick} onAutoConnect={handleAutoConnect} connectedOutputs={connectedOutputs} />
    },
  }), [handleOutputDocClick, handleAutoConnect, edges])

  // 自动保存函数
  const autoSave = useCallback(async () => {
    if (isInitialized && nodes.length > 0) {
      try {
        setIsSaving(true)
        await window.electron.agent.saveWorkflow({ nodes, edges })
        setLastSavedAt(new Date().toLocaleTimeString())
        console.log('自动保存成功')
      } catch (error) {
        console.error('自动保存失败:', error)
      } finally {
        setIsSaving(false)
      }
    }
  }, [nodes, edges, isInitialized])

  // 监听节点变化，触发自动保存
  useEffect(() => {
    if (!isInitialized) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSave()
    }, 1000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [nodes, edges, autoSave, isInitialized])

  // 加载上次保存的工作流
  useEffect(() => {
    const loadSavedWorkflow = async () => {
      try {
        const result = await window.electron.agent.loadCurrentWorkflow()
        if (result.success && result.workflow) {
          console.log('加载上次保存的工作流:', result.workflow)
          setNodes(result.workflow.nodes || [])
          setEdges(result.workflow.edges || [])
          if (result.workflow.savedAt) {
            setLastSavedAt(new Date(result.workflow.savedAt).toLocaleTimeString())
          }
        }
      } catch (error) {
        console.error('加载工作流失败:', error)
      } finally {
        setIsInitialized(true)
      }
    }

    loadSavedWorkflow()
  }, [setNodes, setEdges])

  // 处理连线
  const onConnect = useCallback(
    (connection: Connection) => {
      console.log('连线创建:', connection)
      
      // 检查源节点和目标节点
      const sourceNode = nodes.find(n => n.id === connection.source)
      const targetNode = nodes.find(n => n.id === connection.target)
      
      // 文档类型到智能体类型的映射
      const docToAgentMap: Record<string, string[]> = {
        uiDoc: ['uiDesigner'],
        architectDoc: ['architect'],
        frontendDoc: ['frontendEngineer'],
        backendDoc: ['backendEngineer'],
        qaDoc: ['functionalTester', 'uiTester']
      }
      
      // 检查是否是框节点到智能体节点的连接
      if (sourceNode && sourceNode.data.type === 'boxNode' && targetNode && targetNode.data.type !== 'boxNode') {
        const sourceHandle = connection.sourceHandle
        if (sourceHandle) {
          const allowedAgentTypes = docToAgentMap[sourceHandle]
          if (allowedAgentTypes && !allowedAgentTypes.includes(targetNode.data.type)) {
            // 类型不匹配，提示用户
            const docTypeMap: Record<string, string> = {
              uiDoc: 'UI设计文档',
              architectDoc: '架构设计文档',
              frontendDoc: '前端开发文档',
              backendDoc: '后端开发文档',
              qaDoc: '测试用例文档'
            }
            const agentTypeMap: Record<string, string> = {
              uiDesigner: 'UI设计师',
              architect: '架构师',
              frontendEngineer: '前端工程师',
              backendEngineer: '后端工程师',
              functionalTester: '功能测试工程师',
              uiTester: 'UI测试工程师'
            }
            
            const docLabel = docTypeMap[sourceHandle] || sourceHandle
            const agentLabel = agentTypeMap[targetNode.data.type] || targetNode.data.type
            const allowedAgents = allowedAgentTypes.map(type => agentTypeMap[type] || type).join('、')
            
            alert(`❌ 类型不匹配\n\n${docLabel}应该连接到: ${allowedAgents}\n\n当前连接到: ${agentLabel}`)
            return
          }
        }
      }
      
      // 创建连线
      const sourceHandle = connection.sourceHandle
      const docToAgentColorMap: Record<string, string> = {
        uiDoc: '#ec4899',
        architectDoc: '#10b981',
        frontendDoc: '#06b6d4',
        backendDoc: '#14b8a6',
        qaDoc: '#d97706'
      }
      
      const edgeColor = sourceHandle ? docToAgentColorMap[sourceHandle] || '#3b82f6' : '#3b82f6'
      
      const newEdge: Edge = {
        id: `edge_${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        animated: true,
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor }
      }
      setEdges((eds) => [...eds, newEdge])
    },
    [nodes, setEdges]
  )

  // 处理连线开始
  const onConnectStart = useCallback(
    (_: React.MouseEvent, params: any) => {
      console.log('连线开始:', params)
    },
    []
  )

  // 处理连线结束
  const onConnectEnd = useCallback(
    (_: React.MouseEvent) => {
      console.log('连线结束')
    },
    []
  )

  // 处理连线点击（删除）
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (confirm('删除此连接？')) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id))
      }
    },
    [setEdges]
  )

  // 处理连线双击（删除）
  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
    },
    [setEdges]
  )

  // 处理重新连线
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      console.log('重新连线:', oldEdge, newConnection)
      setEdges((eds) => eds.filter((e) => e.id !== oldEdge.id))
      
      const newEdge: Edge = {
        id: `edge_${Date.now()}`,
        source: newConnection.source!,
        target: newConnection.target!,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
      }
      setEdges((eds) => [...eds, newEdge])
    },
    [setEdges]
  )

  // 重新连线开始
  const onReconnectStart = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      console.log('重新连线开始:', edge)
    },
    []
  )

  // 重新连线结束
  const onReconnectEnd = useCallback(
    (_: React.MouseEvent) => {
      console.log('重新连线结束')
    },
    []
  )

  // 处理节点双击
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<CustomNodeData>) => {
      setSelectedNode(node)
      setIsModalOpen(true)
    },
    []
  )

  // 处理节点右键点击
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<CustomNodeData>) => {
      event.preventDefault()
      event.stopPropagation()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id
      })
    },
    []
  )

  // 删除节点
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setContextMenu(null)
    },
    [setNodes, setEdges]
  )

  // 点击画布关闭右键菜单
  const onPaneClick = useCallback(() => {
    setContextMenu(null)
  }, [])

  // 拖拽开始
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label }))
    event.dataTransfer.effectAllowed = 'move'
  }

  // 拖拽覆盖
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  // 放置节点
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      if (!reactFlowInstance) return

      try {
        const nodeDataStr = event.dataTransfer.getData('application/reactflow')
        if (!nodeDataStr) return

        const nodeData = JSON.parse(nodeDataStr)
        
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY
        })

        const newNode: Node<CustomNodeData> = {
          id: `node_${Date.now()}`,
          type: nodeData.type,
          position,
          data: { label: nodeData.label, type: nodeData.type },
        }

        setNodes((nds) => [...nds, newNode])
      } catch (error) {
        console.error('拖拽错误:', error)
      }
    },
    [reactFlowInstance, setNodes]
  )

  // 更新节点配置
  const updateNodeConfig = (key: string, value: any) => {
    if (!selectedNode) return

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              [key]: value,
            },
          }
        }
        return node
      })
    )

    setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, [key]: value } } : null)
  }

  // 运行工作流
  const handleRunWorkflow = async () => {
    console.log('运行工作流:', { nodes, edges })
    setIsExecuting(true)
    setIsPaused(false)
    setExecutionResult(null)
    setLogs([])
    addLog('info', '开始执行工作流...')

    // 重置所有节点状态
    setNodes((nds) => nds.map((node) => ({
      ...node,
      data: { ...node.data, status: 'pending', progress: 0 }
    })))

    try {
      const result = await window.electron.agent.executeWorkflow({ nodes, edges })
      console.log('工作流执行结果:', result)
      setExecutionResult(result)

      if (result.outputs) {
        setNodes((nds) =>
          nds.map((node) => {
            const nodeOutput = result.outputs[node.id]
            if (nodeOutput) {
              // 处理框智能体的特殊输出
              if (node.data.type === 'boxNode' && nodeOutput.success) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    output: nodeOutput,
                    uiDoc: nodeOutput.uiDoc,
                    architectDoc: nodeOutput.architectDoc,
                    frontendDoc: nodeOutput.frontendDoc,
                    backendDoc: nodeOutput.backendDoc,
                    qaDoc: nodeOutput.qaDoc,
                    status: 'completed',
                    progress: 100,
                  },
                }
              }
              
              // 普通节点处理
              return {
                ...node,
                data: {
                  ...node.data,
                  output: nodeOutput,
                  status: 'completed',
                  progress: 100,
                },
              }
            }
            return node
          })
        )
      }

      addLog('success', '工作流执行完成！')
      alert('工作流执行完成！')
    } catch (error) {
      console.error('工作流执行失败:', error)
      addLog('error', `工作流执行失败: ${error}`)
      alert('工作流执行失败，请查看控制台日志')
    } finally {
      setIsExecuting(false)
      setIsPaused(false)
    }
  }

  // 暂停工作流
  const handlePauseWorkflow = async () => {
    try {
      const result = await window.electron.agent.pauseWorkflow()
      if (result.success) {
        setIsPaused(true)
        addLog('info', '工作流已暂停')
      } else {
        addLog('error', `暂停失败: ${result.error}`)
      }
    } catch (error) {
      console.error('暂停工作流失败:', error)
      addLog('error', `暂停工作流失败: ${error}`)
    }
  }

  // 恢复工作流
  const handleResumeWorkflow = async () => {
    try {
      const result = await window.electron.agent.resumeWorkflow()
      if (result.success) {
        setIsPaused(false)
        addLog('info', '工作流已恢复')
      } else {
        addLog('error', `恢复失败: ${result.error}`)
      }
    } catch (error) {
      console.error('恢复工作流失败:', error)
      addLog('error', `恢复工作流失败: ${error}`)
    }
  }

  // 手动保存工作流
  const handleSaveWorkflow = async () => {
    try {
      setIsSaving(true)
      console.log('开始保存工作流，nodes:', nodes, 'edges:', edges)
      const result = await window.electron.agent.saveWorkflowAsFile({ nodes, edges })
      console.log('保存结果:', result)
      if (result.success) {
        setLastSavedAt(new Date().toLocaleTimeString())
        alert(`工作流已保存到:\n${result.filePath}`)
      } else if (result.canceled) {
        console.log('用户取消保存')
      } else {
        console.error('保存失败，错误信息:', result.error)
        // 检查是否是权限错误
        const errorMessage = result.error || '未知错误'
        if (errorMessage.includes('permission') || errorMessage.includes('EPERM') || errorMessage.includes('权限')) {
          alert(`保存失败: 权限不足\n\n错误信息: ${errorMessage}\n\n请尝试:\n1. 选择其他目录保存（如桌面或下载文件夹）\n2. 或前往系统设置 > 安全性与隐私 > 隐私 > 完全磁盘访问权限，为应用添加权限`)
        } else {
          alert(`保存失败:\n${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('保存失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('permission') || errorMessage.includes('EPERM') || errorMessage.includes('权限')) {
        alert(`保存失败: 权限不足\n\n错误信息: ${errorMessage}\n\n请尝试:\n1. 选择其他目录保存（如桌面或下载文件夹）\n2. 或前往系统设置 > 安全性与隐私 > 隐私 > 完全磁盘访问权限，为应用添加权限`)
      } else {
        alert(`保存失败:\n${errorMessage}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // 加载工作流
  const handleLoadWorkflow = async () => {
    try {
      const result = await window.electron.agent.loadWorkflowFromFile()
      if (result.success && result.workflow) {
        setNodes(result.workflow.nodes || [])
        setEdges(result.workflow.edges || [])
        if (result.workflow.savedAt) {
          setLastSavedAt(new Date(result.workflow.savedAt).toLocaleTimeString())
        }
        alert(`工作流已从以下文件加载:\n${result.filePath}`)
      } else if (!result.canceled) {
        if (result.error) {
          alert(`加载失败:\n${result.error}`)
        } else {
          alert('加载失败')
        }
      }
    } catch (error) {
      console.error('加载失败:', error)
      alert(`加载失败:\n${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 快速保存工作流（保存到配置文件）
  const handleQuickSaveWorkflow = async () => {
    try {
      setIsSaving(true)
      await window.electron.agent.saveWorkflow({ nodes, edges })
      setLastSavedAt(new Date().toLocaleTimeString())
      alert('工作流已快速保存')
    } catch (error) {
      console.error('快速保存失败:', error)
      alert('快速保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  // 快速加载工作流（从配置文件加载）
  const handleQuickLoadWorkflow = async () => {
    try {
      const result = await window.electron.agent.loadCurrentWorkflow()
      if (result.success && result.workflow) {
        setNodes(result.workflow.nodes || [])
        setEdges(result.workflow.edges || [])
        if (result.workflow.savedAt) {
          setLastSavedAt(new Date(result.workflow.savedAt).toLocaleTimeString())
        }
        alert('工作流已快速加载')
      } else {
        if (result.error) {
          alert(`快速加载失败:\n${result.error}`)
        } else {
          alert('没有找到保存的工作流')
        }
      }
    } catch (error) {
      console.error('快速加载失败:', error)
      alert(`快速加载失败:\n${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 清空工作流
  const handleClearWorkflow = () => {
    if (confirm('确定清空？')) {
      setNodes([])
      setEdges([])
      setExecutionResult(null)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* 左侧节点工具栏 */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <button
          onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
          style={{
            width: '20px',
            height: '60px',
            border: 'none',
            backgroundColor: '#e2e8f0',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            borderRadius: '0 4px 4px 0',
            borderLeft: '1px solid #cbd5e1',
            color: '#64748b',
            zIndex: 100,
            position: 'relative'
          }}
        >
          {leftSidebarCollapsed ? '展开' : '收起'}
        </button>
      </div>
      <div style={{ 
        width: leftSidebarCollapsed ? '0px' : '180px', 
        backgroundColor: '#f8fafc', 
        borderRight: leftSidebarCollapsed ? 'none' : '1px solid #e2e8f0',
        padding: leftSidebarCollapsed ? '0px' : '16px',
        paddingRight: leftSidebarCollapsed ? '0px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'hidden',
        maxHeight: '100vh',
        transition: 'width 0.3s ease, padding 0.3s ease, border-right 0.3s ease'
      }}>
        {!leftSidebarCollapsed && (
          <h3 style={{ margin: 0, fontSize: '14px', color: '#475569', marginBottom: '8px' }}>智能体节点</h3>
        )}
        {!leftSidebarCollapsed && nodeTemplates.map((template) => {
          const icon = template.label.charAt(0)
          return (
            <div
              key={template.type}
              draggable
              onDragStart={(event) => onDragStart(event, template.type, template.label)}
              style={{
                padding: '10px 12px',
                backgroundColor: template.color,
                color: 'white',
                borderRadius: '6px',
                cursor: 'grab',
                fontSize: '13px',
                fontWeight: '500',
                userSelect: 'none',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={template.label}
            >
              {template.label}
            </div>
          )
        })}
      </div>

      {/* 主画布区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onReconnect={onReconnect}
            onReconnectStart={onReconnectStart}
            onReconnectEnd={onReconnectEnd}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{
              padding: 200
            }}
            defaultViewport={{
              x: 0,
              y: 0,
              zoom: 0.25
            }}
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            reconnectRadius={40}
            connectionMode={ConnectionMode.Loose}
            snapToGrid={false}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#3b82f6', strokeWidth: 3 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
            }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* 底部操作栏 */}
        <div style={{ 
          padding: '12px 20px', 
          backgroundColor: '#f8fafc', 
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={handleRunWorkflow}
              disabled={isExecuting}
              style={{ 
                padding: '8px 16px',
                backgroundColor: isExecuting ? '#93c5fd' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isExecuting ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {isExecuting ? '执行中...' : '▶ 运行工作流'}
            </button>
            <button 
              onClick={handlePauseWorkflow}
              disabled={!isExecuting || isPaused}
              style={{ 
                padding: '8px 16px',
                backgroundColor: isPaused ? '#93c5fd' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (!isExecuting || isPaused) ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              ⏸️ 暂停
            </button>
            <button 
              onClick={handleResumeWorkflow}
              disabled={!isPaused}
              style={{ 
                padding: '8px 16px',
                backgroundColor: isPaused ? '#10b981' : '#93c5fd',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: !isPaused ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              ▶️ 恢复
            </button>
            <button 
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              style={{ 
                padding: '8px 16px',
                backgroundColor: isSaving ? '#6ee7b7' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {isSaving ? '保存中...' : '💾 保存为文件'}
            </button>
            <button 
              onClick={handleLoadWorkflow}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📂 打开文件
            </button>
            <button 
              onClick={handleQuickSaveWorkflow}
              disabled={isSaving}
              style={{ 
                padding: '8px 16px',
                backgroundColor: isSaving ? '#6ee7b7' : '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {isSaving ? '保存中...' : '⚡ 快速保存'}
            </button>
            <button 
              onClick={handleQuickLoadWorkflow}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ⚡ 快速加载
            </button>
            <button 
              onClick={handleClearWorkflow}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🗑️ 清空
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {lastSavedAt && (
              <span style={{ 
                fontSize: '12px', 
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: '#10b981' 
                }}></span>
                已保存: {lastSavedAt}
              </span>
            )}
            {isSaving && (
              <span style={{ fontSize: '12px', color: '#f59e0b' }}>
                保存中...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 右侧结果面板 */}
      <div style={{ 
        width: rightSidebarCollapsed ? '0px' : '300px', 
        backgroundColor: '#f8fafc', 
        borderLeft: rightSidebarCollapsed ? 'none' : '1px solid #e2e8f0',
        padding: rightSidebarCollapsed ? '0px' : '16px',
        paddingLeft: rightSidebarCollapsed ? '0px' : '16px',
        overflow: 'hidden',
        transition: 'width 0.3s ease, padding 0.3s ease, border-left 0.3s ease'
      }}>
        {!rightSidebarCollapsed && (
          <h3 style={{ margin: 0, fontSize: '14px', color: '#475569', marginBottom: '16px' }}>执行结果</h3>
        )}
        {!rightSidebarCollapsed && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', color: '#475569', marginBottom: '8px' }}>执行日志</h4>
              <div style={{ 
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                padding: '10px'
              }}>
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} style={{ 
                      marginBottom: '6px',
                      fontSize: '12px',
                      color: log.type === 'info' ? '#3b82f6' : log.type === 'success' ? '#10b981' : '#ef4444'
                    }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', marginRight: '8px' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {log.message}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    暂无日志
                  </div>
                )}
              </div>
            </div>
            
            {executionResult && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#475569', marginBottom: '8px' }}>执行结果</h4>
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: executionResult.status === 'completed' ? '#dcfce7' : '#fef2f2',
                  color: executionResult.status === 'completed' ? '#166534' : '#991b1b',
                  borderRadius: '6px',
                  marginBottom: '12px'
                }}>
                  状态: {executionResult.status === 'completed' ? '✅ 完成' : '❌ 失败'}
                </div>
                
                {executionResult.outputs && Object.entries(executionResult.outputs).map(([nodeId, output]) => {
                  const node = nodes.find(n => n.id === nodeId)
                  return (
                    <div key={nodeId} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        {node?.data.label || `节点 ${nodeId}`}
                      </div>
                      <div style={{ 
                        fontSize: '12px',
                        color: '#334155',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        backgroundColor: 'white',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {String(output)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {/* 右侧折叠按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <button
          onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
          style={{
            width: '20px',
            height: '60px',
            border: 'none',
            backgroundColor: '#e2e8f0',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            borderRadius: '4px 0 0 4px',
            borderRight: '1px solid #cbd5e1',
            color: '#64748b',
            zIndex: 100
          }}
        >
          {rightSidebarCollapsed ? '展开' : '收起'}
        </button>
      </div>
      {/* 节点配置弹窗 */}
      {isModalOpen && selectedNode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setIsModalOpen(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '420px'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                节点配置: {selectedNode.data.label}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer' 
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                名称
              </label>
              <input
                type="text"
                value={selectedNode.data.label}
                onChange={(e) => {
                  updateNodeConfig('label', e.target.value)
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* 内容物特殊功能 */}
            {['productDoc', 'designDoc', 'uiInterface', 'codeFile', 'projectSpec'].includes(selectedNode.type as string) && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  文件路径
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={selectedNode.data.path || ''}
                    onChange={(e) => {
                      updateNodeConfig('path', e.target.value)
                    }}
                    placeholder="选择文件或文件夹..."
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={async () => {
                      const result = await window.electron.agent.selectFile()
                      if (result.success && result.paths) {
                        updateNodeConfig('path', result.paths[0])
                      }
                    }}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    📁
                  </button>
                </div>
                {selectedNode.data.path && (
                  <button
                    onClick={async () => {
                      await window.electron.agent.openFile(selectedNode.data.path)
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🔗 打开文件/文件夹
                  </button>
                )}
              </div>
            )}

            {/* 框节点特殊功能 */}
            {selectedNode.type === 'boxNode' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  📥 输入内容物管理
                </label>
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#fef3c7', 
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  {(selectedNode.data.inputContent || []).map((item, index) => (
                    <div key={item.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '13px' }}>
                        {(() => {
                          switch (item.type) {
                            case 'productDoc': return '📄'
                            case 'designDoc': return '🎨'
                            case 'uiInterface': return '🖼️'
                            case 'codeFile': return '💻'
                            case 'projectSpec': return '📋'
                            default: return '📁'
                          }
                        })()} {item.label}
                      </span>
                      <button
                        onClick={() => {
                          const newInputContent = [...(selectedNode.data.inputContent || [])]
                          newInputContent.splice(index, 1)
                          updateNodeConfig('inputContent', newInputContent)
                        }}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={async () => {
                      const result = await window.electron.agent.selectFile()
                      if (result.success && result.paths) {
                        const newItem: ContentItem = {
                          id: Date.now().toString(),
                          type: 'productDoc',
                          label: result.paths[0].split('/').pop() || '新文件',
                          path: result.paths[0]
                        }
                        updateNodeConfig('inputContent', [...(selectedNode.data.inputContent || []), newItem])
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#d97706',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    + 添加输入内容物
                  </button>
                </div>

                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  📤 输出内容物管理
                </label>
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#d1fae5', 
                  borderRadius: '8px'
                }}>
                  {(selectedNode.data.outputContent || []).map((item, index) => (
                    <div key={item.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '13px' }}>
                        {(() => {
                          switch (item.type) {
                            case 'productDoc': return '📄'
                            case 'designDoc': return '🎨'
                            case 'uiInterface': return '🖼️'
                            case 'codeFile': return '💻'
                            case 'projectSpec': return '📋'
                            default: return '📁'
                          }
                        })()} {item.label}
                      </span>
                      <button
                        onClick={() => {
                          const newOutputContent = [...(selectedNode.data.outputContent || [])]
                          newOutputContent.splice(index, 1)
                          updateNodeConfig('outputContent', newOutputContent)
                        }}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={async () => {
                      const result = await window.electron.agent.selectFile()
                      if (result.success && result.paths) {
                        const newItem: ContentItem = {
                          id: Date.now().toString(),
                          type: 'productDoc',
                          label: result.paths[0].split('/').pop() || '新文件',
                          path: result.paths[0]
                        }
                        updateNodeConfig('outputContent', [...(selectedNode.data.outputContent || []), newItem])
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    + 添加输出内容物
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                备注
              </label>
              <textarea
                value={selectedNode.data.input || ''}
                onChange={(e) => updateNodeConfig('input', e.target.value)}
                placeholder="添加备注..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            {selectedNode.data.output && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  输出结果
                </label>
                <div style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '13px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {String(selectedNode.data.output)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          padding: '8px 0',
          minWidth: '160px',
          zIndex: 2000,
          border: '1px solid #e2e8f0'
        }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              const node = nodes.find(n => n.id === contextMenu.nodeId)
              if (node) {
                setSelectedNode(node)
                setIsModalOpen(true)
              }
              setContextMenu(null)
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span>⚙️</span> 配置节点
          </button>
          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
          <button
            onClick={() => deleteNode(contextMenu.nodeId)}
            style={{
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span>🗑️</span> 删除节点
          </button>
        </div>
      )}

      {/* 文档查看弹窗 */}
      {docViewer.open && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setDocViewer({ ...docViewer, open: false })}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '800px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                📄 {docViewer.title}
              </h3>
              <button 
                onClick={() => setDocViewer({ ...docViewer, open: false })}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#f3f4f6',
                  cursor: 'pointer',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#374151',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {docViewer.content}
            </div>
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button 
                onClick={() => setDocViewer({ ...docViewer, open: false })}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 主组件 - 只包含ReactFlowProvider
const WorkflowDesigner = () => {
  return (
    <ReactFlowProvider>
      <style>{customStyles}</style>
      <WorkflowDesignerInner />
    </ReactFlowProvider>
  )
}

export default WorkflowDesigner
