import React, { useState, useCallback, useRef, useEffect } from 'react'
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
type CustomNodeType = 'marketResearch' | 'productManager' | 'uiDesigner' | 'architect' | 'frontendEngineer' | 'backendEngineer' | 'uiTester' | 'functionalTester' | 'boxNode' | 'productDoc' | 'designDoc' | 'uiInterface' | 'codeFile' | 'projectSpec'

// 内容物项接口
interface ContentItem {
  id: string
  type: CustomNodeType
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
  { type: 'boxNode' as const, label: '📦 框节点', color: '#64748b' },
  { type: 'productDoc' as const, label: '📄 产品文档', color: '#ef4444' },
  { type: 'designDoc' as const, label: '🎨 设计文档', color: '#f97316' },
  { type: 'uiInterface' as const, label: '🖼️ UI界面', color: '#eab308' },
  { type: 'codeFile' as const, label: '💻 代码', color: '#22c55e' },
  { type: 'projectSpec' as const, label: '📋 项目规范', color: '#0ea5e9' },
]

// 自定义节点组件
const CustomNode = ({ data, selected }: { data: CustomNodeData; selected?: boolean }) => {
  const getColor = (type: string) => {
    const template = nodeTemplates.find(t => t.type === type)
    return template?.color || '#2563eb'
  }

  const getContentIcon = (type: CustomNodeType) => {
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
  const isContentNode = ['productDoc', 'designDoc', 'uiInterface', 'codeFile', 'projectSpec'].includes(data.type)

  const handleNodeClick = (e: React.MouseEvent) => {
    if (isContentNode && data.path) {
      e.stopPropagation()
      window.electron.agent.openFile(data.path)
    }
  }

  const handleContentItemClick = (e: React.MouseEvent, item: ContentItem) => {
    e.stopPropagation()
    if (item.path) {
      window.electron.agent.openFile(item.path)
    }
  }

  if (isBoxNode) {
    return (
      <div style={{
        position: 'relative',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '3px solid ' + getColor(data.type),
        boxShadow: selected ? '0 0 0 3px #60a5fa, 0 8px 24px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.1)',
        cursor: 'move',
        userSelect: 'none',
        minWidth: '380px',
        minHeight: '300px',
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
          gap: '8px'
        }}>
          📦 {data.label}
        </div>

        {/* 输入区 */}
        <div style={{
          padding: '12px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#fef3c7'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#92400e',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            📥 输入区
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(data.inputContent || []).map((item) => (
              <div
                key={item.id}
                onClick={(e) => handleContentItemClick(e, item)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: item.path ? 'pointer' : 'default',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                {getContentIcon(item.type)} {item.label}
                {item.path && <span>🔗</span>}
              </div>
            ))}
            {(!data.inputContent || data.inputContent.length === 0) && (
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>暂无输入内容</span>
            )}
          </div>
        </div>

        {/* 内容物编辑区 */}
        <div style={{
          flex: 1,
          padding: '12px',
          backgroundColor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>双击配置内容物处理规则</span>
        </div>

        {/* 输出区 */}
        <div style={{
          padding: '12px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#d1fae5'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#065f46',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            📤 输出区
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(data.outputContent || []).map((item) => (
              <div
                key={item.id}
                onClick={(e) => handleContentItemClick(e, item)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: item.path ? 'pointer' : 'default',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                {getContentIcon(item.type)} {item.label}
                {item.path && <span>🔗</span>}
              </div>
            ))}
            {(!data.outputContent || data.outputContent.length === 0) && (
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>暂无输出内容</span>
            )}
          </div>
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
            top: '50%',
            zIndex: 20,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
          }} 
        />
      </div>
    )
  }

  return (
    <div 
      onClick={handleNodeClick}
      style={{
        position: 'relative',
        padding: '14px 24px',
        borderRadius: '10px',
        backgroundColor: getColor(data.type),
        color: 'white',
        fontSize: '15px',
        fontWeight: '600',
        boxShadow: selected ? '0 0 0 3px #60a5fa, 0 4px 12px rgba(0,0,0,0.2)' : '0 3px 10px rgba(0,0,0,0.18)',
        cursor: isContentNode && data.path ? 'pointer' : 'move',
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
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        {isContentNode && data.path && <span>🔗</span>}
        {data.label}
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

// 节点类型映射
const nodeTypes = {
  marketResearch: CustomNode,
  productManager: CustomNode,
  uiDesigner: CustomNode,
  architect: CustomNode,
  frontendEngineer: CustomNode,
  backendEngineer: CustomNode,
  uiTester: CustomNode,
  functionalTester: CustomNode,
  boxNode: CustomNode,
  productDoc: CustomNode,
  designDoc: CustomNode,
  uiInterface: CustomNode,
  codeFile: CustomNode,
  projectSpec: CustomNode,
}

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
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    nodeId: string
  } | null>(null)

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
      const newEdge: Edge = {
        id: `edge_${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
      }
      setEdges((eds) => [...eds, newEdge])
    },
    [setEdges]
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
    setExecutionResult(null)

    try {
      const result = await window.electron.agent.executeWorkflow({ nodes, edges })
      console.log('工作流执行结果:', result)
      setExecutionResult(result)

      if (result.outputs) {
        setNodes((nds) =>
          nds.map((node) => {
            if (result.outputs[node.id]) {
              return {
                ...node,
                data: {
                  ...node.data,
                  output: result.outputs[node.id],
                },
              }
            }
            return node
          })
        )
      }

      alert('工作流执行完成！')
    } catch (error) {
      console.error('工作流执行失败:', error)
      alert('工作流执行失败，请查看控制台日志')
    } finally {
      setIsExecuting(false)
    }
  }

  // 手动保存工作流
  const handleSaveWorkflow = async () => {
    try {
      setIsSaving(true)
      await window.electron.agent.saveWorkflow({ nodes, edges })
      setLastSavedAt(new Date().toLocaleTimeString())
      alert('工作流已保存')
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  // 加载工作流
  const handleLoadWorkflow = async () => {
    try {
      const result = await window.electron.agent.loadCurrentWorkflow()
      if (result.success && result.workflow) {
        setNodes(result.workflow.nodes || [])
        setEdges(result.workflow.edges || [])
        if (result.workflow.savedAt) {
          setLastSavedAt(new Date(result.workflow.savedAt).toLocaleTimeString())
        }
        alert('工作流已加载')
      } else {
        alert('没有找到保存的工作流')
      }
    } catch (error) {
      console.error('加载失败:', error)
      alert('加载失败')
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
      <div style={{ 
        width: '180px', 
        backgroundColor: '#f8fafc', 
        borderRight: '1px solid #e2e8f0',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
        maxHeight: '100vh'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#475569', marginBottom: '8px' }}>智能体节点</h3>
        {nodeTemplates.map((template) => (
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
              textAlign: 'center'
            }}
          >
            {template.label}
          </div>
        ))}
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
              {isSaving ? '保存中...' : '💾 保存'}
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
              📂 加载
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
        width: '300px', 
        backgroundColor: '#f8fafc', 
        borderLeft: '1px solid #e2e8f0',
        padding: '16px',
        overflowY: 'auto'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#475569', marginBottom: '16px' }}>执行结果</h3>
        {executionResult ? (
          <div>
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
                    maxHeight: '200px',
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
        ) : (
          <div style={{ 
            color: '#94a3b8', 
            fontSize: '13px', 
            textAlign: 'center',
            padding: '40px 20px'
          }}>
            点击"运行工作流"开始执行
          </div>
        )}
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
