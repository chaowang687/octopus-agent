  const setupEventListeners = () => {
    const handleStreamEvent = (event: any) => {
      console.log('[MultiAgentDashboard] 收到 chat:stream 事件:', event)
      
      const data = event
      
      if (data.agentId || data.agentName) {
        // 处理智能体消息，提取结构化数据
        handleAgentMessage({
          agentId: data.agentId,
          agentName: data.agentName,
          role: data.role,
          content: data.content || data.delta,
          timestamp: data.timestamp || Date.now(),
          phase: data.phase
        })
        
        // 如果包含结构化输出数据，同时更新
        if (data.nextSteps || data.completedTasks || data.outputFiles) {
          handleStructuredOutput({
            agentName: data.agentName,
            phase: data.phase,
            content: data.content || '',
            nextSteps: data.nextSteps || [],
            completedTasks: data.completedTasks || [],
            outputFiles: data.outputFiles || []
          })
        }
      } else if (data.progress !== undefined) {
        handleProgressUpdate({
          phase: data.phase || 'implementation',
          progress: data.progress,
          message: data.message || data.description,
          subTasks: data.subTasks || data.planSteps
        })
      } else if (data.type === 'agent_status' || data.eventType === 'agent_status') {
        handleAgentStatusUpdate(data)
      } else if (data.type === 'file_created' || data.eventType === 'file_created') {
        handleFileCreated(data)
      } else if (data.type === 'error_occurred' || data.eventType === 'error_occurred') {
        handleErrorOccurred(data)
      } else if (data.type === 'task_paused' || data.eventType === 'task_paused') {
        setTaskState(prev => ({ ...prev, isPaused: true }))
      } else if (data.type === 'task_resumed' || data.eventType === 'task_resumed') {
        setTaskState(prev => ({ ...prev, isPaused: false }))
      } else if (data.type === 'task_cancelled' || data.eventType === 'task_cancelled') {
        setTaskState(prev => ({ ...prev, isCancelled: true, endTime: Date.now() }))
      } else if (data.type === 'task_completed' || data.eventType === 'task_completed') {
        setTaskState(prev => ({ ...prev, progress: 100, endTime: Date.now() }))
        onTaskComplete?.(data)
      } else if (data.type === 'structured_output' || data.eventType === 'structured_output') {
        handleStructuredOutput(data)
      }
    }
