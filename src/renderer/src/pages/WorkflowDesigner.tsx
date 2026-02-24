import React, { useState, useCallback, useRef } from 'react'
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
} from 'reactflow'
import 'reactflow/dist/style.css'

// 节点类型定义
type CustomNodeType = 'marketResearch' | 'productManager' | 'uiDesigner' | 'developer' | 'qaTester'

// 自定义节点数据接口
interface CustomNodeData {
  label: string
  type: CustomNodeType
  input?: string
  output?: string
}

// 节点模板
const nodeTemplates = [
  { type: 'marketResearch' as const, label: '市场调研', color: '#3b82f6' },
  { type: 'productManager' as const, label: '产品经理', color: '#8b5cf6' },
  { type: 'uiDesigner' as const, label: 'UI设计师', color: '#ec4899' },
  { type: 'developer' as const, label: '开发工程师', color: '#10b981' },
  { type: 'qaTester' as const, label: '测试工程师', color: '#f59e0b' },
]

// 自定义节点组件
const CustomNode = ({ data, selected }: { data: CustomNodeData; selected?: boolean }) => {
  const getColor = (type: string) => {
    const template = nodeTemplates.find(t => t.type === type)
    return template?.color || '#2563eb'
  }

  return (
    <div style={{
      padding: '10px 15px',
      borderRadius: '8px',
      backgroundColor: getColor(data.type),
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: selected ? '0 0 0 2px #60a5fa' : '0 2px 8px rgba(0,0,0,0.15)',
      cursor: 'move',
      userSelect: 'none',
      minWidth: '100px',
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={{ width: '10px', height: '10px', backgroundColor: '#fff' }} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} style={{ width: '10px', height: '10px', backgroundColor: '#fff' }} />
    </div>
  )
}

// 节点类型映射
const nodeTypes = {
  marketResearch: CustomNode,
  productManager: CustomNode,
  uiDesigner: CustomNode,
  developer: CustomNode,
  qaTester: CustomNode,
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

  // 处理连线
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ 
        ...connection, 
        animated: true,
        style: { stroke: '#64748b', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      }, eds))
    },
    [setEdges]
  )

  // 处理节点双击
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<CustomNodeData>) => {
      setSelectedNode(node)
      setIsModalOpen(true)
    },
    []
  )

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

  // 保存工作流
  const handleSaveWorkflow = async () => {
    const workflow = { nodes, edges }
    try {
      await window.electron.agent.saveWorkflow(workflow)
      alert('工作流已保存')
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    }
  }

  // 加载工作流
  const handleLoadWorkflow = async () => {
    try {
      const result = await window.electron.agent.loadWorkflows()
      if (result.success && result.workflows.length > 0) {
        const latestWorkflow = result.workflows[result.workflows.length - 1]
        setNodes(latestWorkflow.nodes)
        setEdges(latestWorkflow.edges)
        alert('工作流已加载')
      } else {
        alert('没有找到工作流')
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
        gap: '12px'
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
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={true}
            nodesConnectable={true}
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
          alignItems: 'center'
        }}>
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
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            💾 保存
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
            width: '400px'
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
                输入参数
              </label>
              <textarea
                value={selectedNode.data.input || ''}
                onChange={(e) => updateNodeConfig('input', e.target.value)}
                placeholder="输入参数..."
                style={{
                  width: '100%',
                  minHeight: '100px',
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
    </div>
  )
}

// 主组件 - 只包含ReactFlowProvider
const WorkflowDesigner = () => {
  return (
    <ReactFlowProvider>
      <WorkflowDesignerInner />
    </ReactFlowProvider>
  )
}

export default WorkflowDesigner
