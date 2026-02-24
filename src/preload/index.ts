import { contextBridge, ipcRenderer } from 'electron'

// 直接在全局添加 ipcRenderer.invoke 以保持兼容
;(window as any).ipcRendererInvoke = (channel: string, ...args: any[]) => {
  return ipcRenderer.invoke(channel, ...args)
}

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 系统操作
  system: {
    openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),
    captureScreen: () => ipcRenderer.invoke('system:captureScreen'),
    executeCommand: (command: string, args: string[]) => ipcRenderer.invoke('system:executeCommand', command, args),
    executeComplexCommand: (command: string, options?: any) => ipcRenderer.invoke('system:executeComplexCommand', command, options),
    executeShellScript: (script: string, cwd?: string) => ipcRenderer.invoke('system:executeShellScript', script, cwd),
    getSystemInfo: () => ipcRenderer.invoke('system:getSystemInfo')
  },
  // 窗口操作
  window: {
    toggleDock: () => ipcRenderer.invoke('window:toggle-dock'),
    isDocked: () => ipcRenderer.invoke('window:is-docked')
  },
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:showOpenDialog', options)
  },
  // 工具集成
  tools: {
    listTools: () => ipcRenderer.invoke('tools:list'),
    detectTools: () => ipcRenderer.invoke('tools:detect'),
    findPath: (toolId: string) => ipcRenderer.invoke('tools:findPath', toolId),
    configureTool: (toolId: string, customPath: string) => ipcRenderer.invoke('tools:configure', toolId, customPath),
    getToolConfig: (toolId: string) => ipcRenderer.invoke('tools:getConfig', toolId),
    executeToolCommand: (tool: string, command: string, args: any[]) => ipcRenderer.invoke('tools:execute', tool, command, args),
    buildProject: (path: string, tool: string, target: string) => ipcRenderer.invoke('tools:build', path, tool, target),
    openPath: (path: string, tool?: string) => ipcRenderer.invoke('tools:open', path, tool),
    vscode: {
      openProject: (projectPath: string) => ipcRenderer.invoke('tools:vscode:openProject', projectPath),
      createFile: (projectPath: string, fileName: string, content: string) => ipcRenderer.invoke('tools:vscode:createFile', projectPath, fileName, content),
      executeCommand: (command: string, args: string[]) => ipcRenderer.invoke('tools:vscode:executeCommand', command, args)
    }
  },
  // API管理
  api: {
    setApiKey: (model: string, key: string, userId?: string) => ipcRenderer.invoke('api:setKey', model, key, userId),
    getApiKey: (model: string, userId?: string) => ipcRenderer.invoke('api:getKey', model, userId),
    deleteApiKey: (model: string, userId?: string) => ipcRenderer.invoke('api:deleteKey', model, userId),
    testApiKey: (model: string, key: string) => ipcRenderer.invoke('api:testKey', model, key),
    readFile: (path: string) => ipcRenderer.invoke('api:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('api:writeFile', path, content),
    getGitStatus: (projectPath: string) => ipcRenderer.invoke('api:getGitStatus', projectPath),
    getPlanVersions: (projectPath: string) => ipcRenderer.invoke('api:getPlanVersions', projectPath),
    commitPlan: (projectPath: string, message: string) => ipcRenderer.invoke('api:commitPlan', projectPath, message),
    initGit: (projectPath: string) => ipcRenderer.invoke('api:initGit', projectPath),
    restorePlanVersion: (projectPath: string, versionId: string) => ipcRenderer.invoke('api:restorePlanVersion', projectPath, versionId)
  },
  // 本地文件操作
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
    editFile: (path: string, oldContent: string, newContent: string) => ipcRenderer.invoke('fs:editFile', path, oldContent, newContent),
    compareFiles: (path1: string, path2: string) => ipcRenderer.invoke('fs:compareFiles', path1, path2),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    listFiles: (path: string) => ipcRenderer.invoke('fs:listFiles', path),
    listEntries: (dirPath: string) => ipcRenderer.invoke('fs:listEntries', dirPath),
    listDirectories: (dirPath: string) => ipcRenderer.invoke('fs:listDirectories', dirPath),
    getProjectInfo: (projectPath: string) => ipcRenderer.invoke('fs:getProjectInfo', projectPath),
    scanProjectsDirectory: (projectsDir: string) => ipcRenderer.invoke('fs:scanProjectsDirectory', projectsDir),
    runNpmScript: (projectPath: string, scriptName: string) => ipcRenderer.invoke('fs:runNpmScript', projectPath, scriptName)
  },
  // 插件管理
  plugins: {
    listPlugins: () => ipcRenderer.invoke('plugins:list'),
    installPlugin: (url: string) => ipcRenderer.invoke('plugins:install', url),
    uninstallPlugin: (name: string) => ipcRenderer.invoke('plugins:uninstall', name),
    updatePlugin: (name: string) => ipcRenderer.invoke('plugins:update', name),
    enablePlugin: (name: string) => ipcRenderer.invoke('plugins:enable', name),
    disablePlugin: (name: string) => ipcRenderer.invoke('plugins:disable', name),
    execute: (name: string, command: string, args: any[]) => ipcRenderer.invoke('plugins:execute', name, command, args),
    get: (name: string) => ipcRenderer.invoke('plugins:get', name)
  },
  // AI对话
  chat: {
    sendMessage: (model: string, message: string, agentOptions?: { agentId?: string; sessionId?: string }) =>
      ipcRenderer.invoke('chat:sendMessage', model, message, agentOptions),
    cancel: () => ipcRenderer.invoke('chat:cancel'),
    pause: () => ipcRenderer.invoke('chat:pause'),
    resume: () => ipcRenderer.invoke('chat:resume')
  },
  // 网页自动化
  web: {
    crawlPage: (url: string, options?: any) => ipcRenderer.invoke('web:crawlPage', url, options),
    submitForm: (url: string, formData: any, options?: any) => ipcRenderer.invoke('web:submitForm', url, formData, options),
    downloadFile: (url: string, savePath: string, options?: any) => ipcRenderer.invoke('web:downloadFile', url, savePath, options)
  },
  // 智能任务规划和执行
  task: {
    execute: (instruction: string, options?: any) => ipcRenderer.invoke('task:execute', instruction, options),
    cancel: () => ipcRenderer.invoke('task:cancel'),
    onProgress: (callback: (evt: any) => void) => {
      const listener = (_: any, evt: any) => callback(evt)
      ipcRenderer.on('task:progress', listener)
      return () => ipcRenderer.removeListener('task:progress', listener)
    }
  },
  // Webview控制
  webview: {
    openDevTools: () => ipcRenderer.invoke('webview:openDevTools')
  },
  gallery: {
    list: () => ipcRenderer.invoke('gallery:list'),
    import: (filePaths: string[]) => ipcRenderer.invoke('gallery:import', filePaths),
    delete: (id: string) => ipcRenderer.invoke('gallery:delete', id),
    getDataUrl: (filePath: string) => ipcRenderer.invoke('gallery:getDataUrl', filePath),
    reveal: (filePath: string) => ipcRenderer.invoke('gallery:reveal', filePath),
    addTag: (id: string, tag: string) => ipcRenderer.invoke('gallery:addTag', id, tag),
    removeTag: (id: string, tag: string) => ipcRenderer.invoke('gallery:removeTag', id, tag),
    renameItem: (id: string, newName: string) => ipcRenderer.invoke('gallery:renameItem', id, newName)
  },
  // 本地知识库
  kb: {
    initialize: () => ipcRenderer.invoke('kb:initialize'),
    upload: (filePath: string) => ipcRenderer.invoke('kb:upload', filePath),
    list: () => ipcRenderer.invoke('kb:list'),
    delete: (docId: string) => ipcRenderer.invoke('kb:delete', docId),
    search: (query: string) => ipcRenderer.invoke('kb:search', query),
    extract: (docId: string) => ipcRenderer.invoke('kb:extract', docId),
    get: (docId: string) => ipcRenderer.invoke('kb:get', docId)
  },
  // 代码生成和解释
  code: {
    generate: (prompt: string, language: string, options?: any) => ipcRenderer.invoke('code:generate', prompt, language, options),
    explain: (code: string, language: string, options?: any) => ipcRenderer.invoke('code:explain', code, language, options),
    refactor: (code: string, language: string, options?: any) => ipcRenderer.invoke('code:refactor', code, language, options)
  },
  // 数据可视化
  viz: {
    generate: (data: any, chartType: string, options?: any) => ipcRenderer.invoke('viz:generate', data, chartType, options),
    processData: (rawData: any, operation: string, options?: any) => ipcRenderer.invoke('viz:processData', rawData, operation, options),
    analyze: (data: any, options?: any) => ipcRenderer.invoke('viz:analyze', data, options)
  },
  // 个性化设置
  preferences: {
    get: (section?: string) => ipcRenderer.invoke('preferences:get', section),
    set: (section: string, key: string, value: any) => ipcRenderer.invoke('preferences:set', section, key, value),
    setMultiple: (section: string, values: any) => ipcRenderer.invoke('preferences:setMultiple', section, values),
    reset: (section?: string) => ipcRenderer.invoke('preferences:reset', section),
    export: () => ipcRenderer.invoke('preferences:export'),
    import: (filePath: string) => ipcRenderer.invoke('preferences:import', filePath)
  },
  // 项目经理模式
  projectManager: {
    create: (data: any) => ipcRenderer.invoke('projectManager:create', data),
    get: (projectId: string) => ipcRenderer.invoke('projectManager:get', projectId),
    list: (filter?: any) => ipcRenderer.invoke('projectManager:list', filter),
    update: (projectId: string, updates: any) => ipcRenderer.invoke('projectManager:update', projectId, updates),
    delete: (projectId: string) => ipcRenderer.invoke('projectManager:delete', projectId),
    addTask: (data: any) => ipcRenderer.invoke('projectManager:addTask', data),
    getTask: (taskId: string) => ipcRenderer.invoke('projectManager:getTask', taskId),
    getTasks: (projectId: string) => ipcRenderer.invoke('projectManager:getTasks', projectId),
    updateTask: (taskId: string, updates: any) => ipcRenderer.invoke('projectManager:updateTask', taskId, updates),
    deleteTask: (taskId: string) => ipcRenderer.invoke('projectManager:deleteTask', taskId),
    addTaskComment: (taskId: string, author: string, content: string) => ipcRenderer.invoke('projectManager:addTaskComment', taskId, author, content),
    generateReport: (projectId: string, type: string, title: string) => ipcRenderer.invoke('projectManager:generateReport', projectId, type, title),
    getReports: (projectId: string) => ipcRenderer.invoke('projectManager:getReports', projectId),
    getReport: (reportId: string) => ipcRenderer.invoke('projectManager:getReport', reportId),
    estimateTime: (projectId: string) => ipcRenderer.invoke('projectManager:estimateTime', projectId),
    trackProgress: (projectId: string) => ipcRenderer.invoke('projectManager:trackProgress', projectId),
    setMode: (projectId: string, mode: string) => ipcRenderer.invoke('projectManager:setMode', projectId, mode),
    getMode: (projectId: string) => ipcRenderer.invoke('projectManager:getMode', projectId),
    getStatistics: () => ipcRenderer.invoke('projectManager:getStatistics')
  },
  // 文库系统
  library: {
    createDocument: (doc: any) => ipcRenderer.invoke('library:createDocument', doc),
    getDocument: (id: string) => ipcRenderer.invoke('library:getDocument', id),
    updateDocument: (id: string, updates: any) => ipcRenderer.invoke('library:updateDocument', id, updates),
    deleteDocument: (id: string) => ipcRenderer.invoke('library:deleteDocument', id),
    searchDocuments: (query: any) => ipcRenderer.invoke('library:searchDocuments', query),
    getDocumentHistory: (id: string) => ipcRenderer.invoke('library:getDocumentHistory', id),
    restoreVersion: (id: string, version: number) => ipcRenderer.invoke('library:restoreVersion', id, version),
    createPlan: (requirementId: string, metadata?: any) => ipcRenderer.invoke('library:createPlan', requirementId, metadata),
    getPlan: (planId: string) => ipcRenderer.invoke('library:getPlan', planId),
    updatePlan: (planId: string, updates: any) => ipcRenderer.invoke('library:updatePlan', planId, updates),
    getPlanProgress: (planId: string) => ipcRenderer.invoke('library:getPlanProgress', planId),
    createDecision: (request: any) => ipcRenderer.invoke('library:createDecision', request),
    getDecision: (decisionId: string) => ipcRenderer.invoke('library:getDecision', decisionId),
    makeDecision: (decisionId: string, optionId: string, reason?: string) => ipcRenderer.invoke('library:makeDecision', decisionId, optionId, reason),
    getPendingDecisions: (planId?: string) => ipcRenderer.invoke('library:getPendingDecisions', planId),
    startCollaboration: (request: any) => ipcRenderer.invoke('library:startCollaboration', request),
    getCollaborationSession: (sessionId: string) => ipcRenderer.invoke('library:getCollaborationSession', sessionId),
    executePlan: (sessionId: string) => ipcRenderer.invoke('library:executePlan', sessionId),
    makeSessionDecision: (sessionId: string, decisionId: string, optionId: string, reason?: string) => ipcRenderer.invoke('library:makeSessionDecision', sessionId, decisionId, optionId, reason),
    cancelSession: (sessionId: string, reason?: string) => ipcRenderer.invoke('library:cancelSession', sessionId, reason),
    getSessionProgress: (sessionId: string) => ipcRenderer.invoke('library:getSessionProgress', sessionId),
    getSessionPendingDecisions: (sessionId: string) => ipcRenderer.invoke('library:getSessionPendingDecisions', sessionId)
  },
  // 协作事件
  collaboration: {
    onEvent: (callback: (event: any) => void) => {
      const listener = (_: any, event: any) => callback(event)
      ipcRenderer.on('collaboration:event', listener)
      return () => ipcRenderer.removeListener('collaboration:event', listener)
    },
    offEvent: () => {
      ipcRenderer.removeAllListeners('collaboration:event')
    },
    approve: (requestId: string, response?: string) => ipcRenderer.invoke('collaboration:approve', requestId, response),
    reject: (requestId: string, reason?: string) => ipcRenderer.invoke('collaboration:reject', requestId, reason),
    modify: (requestId: string, modifiedParams: any, response?: string) => ipcRenderer.invoke('collaboration:modify', requestId, modifiedParams, response)
  },
  events: {
    onWebviewNewWindow: (callback: (details: { url: string; frameName?: string }) => void) => {
      const listener = (_: any, payload: { url: string; frameName?: string }) => callback(payload)
      ipcRenderer.on('webview-new-window', listener)
      return () => ipcRenderer.removeListener('webview-new-window', listener)
    },
    onAgentOpenPage: (callback: (url: string) => void) => {
      const listener = (_: any, url: string) => callback(url)
      ipcRenderer.on('agent-open-page', listener)
      return () => ipcRenderer.removeListener('agent-open-page', listener)
    },
    onWebviewDownloadStart: (callback: (data: { filename: string; totalBytes: number; url: string }) => void) => {
      const listener = (_: any, data: { filename: string; totalBytes: number; url: string }) => callback(data)
      ipcRenderer.on('webview-download-start', listener)
      return () => ipcRenderer.removeListener('webview-download-start', listener)
    },
    onWebviewDownloadProgress: (callback: (data: { filename: string; receivedBytes: number; totalBytes: number; progress: number }) => void) => {
      const listener = (_: any, data: { filename: string; receivedBytes: number; totalBytes: number; progress: number }) => callback(data)
      ipcRenderer.on('webview-download-progress', listener)
      return () => ipcRenderer.removeListener('webview-download-progress', listener)
    },
    onWebviewDownloadComplete: (callback: (data: { filename: string; savePath?: string; success: boolean; error?: string }) => void) => {
      const listener = (_: any, data: { filename: string; savePath?: string; success: boolean; error?: string }) => callback(data)
      ipcRenderer.on('webview-download-complete', listener)
      return () => ipcRenderer.removeListener('webview-download-complete', listener)
    },
    onWebviewAction: (callback: (data: { action: string; selector?: string; text?: string; scrollTop?: number }) => void) => {
      const listener = (_: any, data: { action: string; selector?: string; text?: string; scrollTop?: number }) => callback(data)
      ipcRenderer.on('webview-action', listener)
      return () => ipcRenderer.removeListener('webview-action', listener)
    }
  },
  // 全能智能体管家
  omni: {
    executeTask: (instruction: string, options?: any) => ipcRenderer.invoke('omni:executeTask', instruction, options),
    getTaskStatus: (taskId: string) => ipcRenderer.invoke('omni:getTaskStatus', taskId),
    getTaskHistory: () => ipcRenderer.invoke('omni:getTaskHistory'),
    clearTaskHistory: () => ipcRenderer.invoke('omni:clearTaskHistory'),
    addProject: (project: any) => ipcRenderer.invoke('omni:addProject', project),
    getProject: (projectId: string) => ipcRenderer.invoke('omni:getProject', projectId),
    getAllProjects: () => ipcRenderer.invoke('omni:getAllProjects'),
    switchProject: (projectId: string) => ipcRenderer.invoke('omni:switchProject', projectId),
    removeProject: (projectId: string) => ipcRenderer.invoke('omni:removeProject', projectId),
    setPermissionLevel: (level: string) => ipcRenderer.invoke('omni:setPermissionLevel', level),
    getPermissionLevel: () => ipcRenderer.invoke('omni:getPermissionLevel'),
    getPermissionLog: () => ipcRenderer.invoke('omni:getPermissionLog'),
    healthCheck: () => ipcRenderer.invoke('omni:healthCheck')
  },
  butler: {
    getAllProjects: () => ipcRenderer.invoke('butler:getAllProjects'),
    getActiveProject: () => ipcRenderer.invoke('butler:getActiveProject'),
    getProject: (projectId: string) => ipcRenderer.invoke('butler:getProject', projectId),
    getProjectReport: (projectId: string) => ipcRenderer.invoke('butler:getProjectReport', projectId),
    getAllProblems: () => ipcRenderer.invoke('butler:getAllProblems'),
    getProblem: (problemId: string) => ipcRenderer.invoke('butler:getProblem', problemId),
    getSolution: (problemId: string) => ipcRenderer.invoke('butler:getSolution', problemId),
    fixProblem: (problemId: string) => ipcRenderer.invoke('butler:fixProblem', problemId),
    getCapabilities: () => ipcRenderer.invoke('butler:getCapabilities'),
    enableCapability: (name: string) => ipcRenderer.invoke('butler:enableCapability', name),
    disableCapability: (name: string) => ipcRenderer.invoke('butler:disableCapability', name),
    cleanup: () => ipcRenderer.invoke('butler:cleanup'),
    registerProblem: (error: any, sourceAgent: string, sourcePhase: string, context?: any) => ipcRenderer.invoke('butler:registerProblem', error, sourceAgent, sourcePhase, context),
    getProjectMemories: (projectId: string) => ipcRenderer.invoke('butler:getProjectMemories', projectId),
    searchProjectMemories: (query: string, projectId?: string) => ipcRenderer.invoke('butler:searchProjectMemories', query, projectId),
    addProjectMemory: (projectId: string, projectName: string, projectPath: string, type: 'issue' | 'solution' | 'preference' | 'pattern' | 'command', content: string, context?: any, importance?: number) => ipcRenderer.invoke('butler:addProjectMemory', projectId, projectName, projectPath, type, content, context, importance),
    updateMemoryImportance: (projectId: string, memoryId: string, importance: number) => ipcRenderer.invoke('butler:updateMemoryImportance', projectId, memoryId, importance),
    deleteMemory: (projectId: string, memoryId: string) => ipcRenderer.invoke('butler:deleteMemory', projectId, memoryId),
    cleanupOldMemories: (maxAge?: number) => ipcRenderer.invoke('butler:cleanupOldMemories', maxAge),
    getProjectTools: () => ipcRenderer.invoke('butler:getProjectTools'),
    executeProjectTool: (toolName: string, projectPath: string, options?: any) => ipcRenderer.invoke('butler:executeProjectTool', toolName, projectPath, options),
    solveProjectProblem: (projectId: string, projectName: string, projectPath: string, problemDescription: string) => ipcRenderer.invoke('butler:solveProjectProblem', projectId, projectName, projectPath, problemDescription)
  },
  // 记忆系统
  memory: {
    getAll: (type?: string) => ipcRenderer.invoke('memory:getAll', type),
    get: (id: string) => ipcRenderer.invoke('memory:get', id),
    add: (memory: any) => ipcRenderer.invoke('memory:add', memory),
    update: (id: string, updates: any) => ipcRenderer.invoke('memory:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', id),
    clear: (type?: string) => ipcRenderer.invoke('memory:clear', type),
    search: (query: string, options?: any) => ipcRenderer.invoke('memory:search', query, options)
  },
  // 智能体设置
  agent: {
    getWorkflowSettings: () => ipcRenderer.invoke('agent:getWorkflowSettings'),
    updateWorkflowSettings: (settings: any) => ipcRenderer.invoke('agent:updateWorkflowSettings', settings),
    executeWorkflow: (workflow: any) => ipcRenderer.invoke('agent:executeWorkflow', workflow),
    saveWorkflow: (workflow: any) => ipcRenderer.invoke('agent:saveWorkflow', workflow),
    loadWorkflows: () => ipcRenderer.invoke('agent:loadWorkflows'),
    getAvailableAgents: () => ipcRenderer.invoke('agent:getAvailableAgents'),
    getAgentConfig: (agentId: string) => ipcRenderer.invoke('agent:getAgentConfig', agentId),
    setAgentConfig: (agentId: string, config: any) => ipcRenderer.invoke('agent:setAgentConfig', agentId, config),
    getToolState: () => ipcRenderer.invoke('agent:getToolState'),
    updateToolState: (state: any) => ipcRenderer.invoke('agent:updateToolState', state)
  },
  // 用户认证
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    register: (username: string, email: string, password: string) => ipcRenderer.invoke('auth:register', username, email, password),
    checkUsername: (username: string) => ipcRenderer.invoke('auth:checkUsername', username),
    logout: (token: string) => ipcRenderer.invoke('auth:logout', token),
    verify: (token: string) => ipcRenderer.invoke('auth:verify', token),
    getCurrentUser: (token: string) => ipcRenderer.invoke('auth:getCurrentUser', token),
    changePassword: (token: string, oldPassword: string, newPassword: string) => ipcRenderer.invoke('auth:changePassword', token, oldPassword, newPassword),
    forgotPassword: (email: string) => ipcRenderer.invoke('auth:forgotPassword', email)
  },
  // 用户管理
  user: {
    getAll: (token: string) => ipcRenderer.invoke('user:getAll', token),
    create: (token: string, username: string, email: string, password: string, role: 'admin' | 'user' | 'guest') => ipcRenderer.invoke('user:create', token, username, email, password, role),
    update: (token: string, userId: string, updates: any) => ipcRenderer.invoke('user:update', token, userId, updates),
    delete: (token: string, userId: string) => ipcRenderer.invoke('user:delete', token, userId),
    setProjectPermission: (token: string, userId: string, projectId: string, role: 'owner' | 'editor' | 'viewer') => ipcRenderer.invoke('user:setProjectPermission', token, userId, projectId, role),
    checkProjectPermission: (token: string, projectId: string, requiredRole: 'owner' | 'editor' | 'viewer') => ipcRenderer.invoke('user:checkProjectPermission', token, projectId, requiredRole)
  },
  // 应用更新
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    getInfo: () => ipcRenderer.invoke('update:getInfo'),
    onChecking: (callback: () => void) => {
      const listener = (_: any) => callback()
      ipcRenderer.on('update:checking', listener)
      return () => ipcRenderer.removeListener('update:checking', listener)
    },
    onAvailable: (callback: (info: any) => void) => {
      const listener = (_: any, info: any) => callback(info)
      ipcRenderer.on('update:available', listener)
      return () => ipcRenderer.removeListener('update:available', listener)
    },
    onNotAvailable: (callback: (info: any) => void) => {
      const listener = (_: any, info: any) => callback(info)
      ipcRenderer.on('update:not-available', listener)
      return () => ipcRenderer.removeListener('update:not-available', listener)
    },
    onError: (callback: (error: any) => void) => {
      const listener = (_: any, error: any) => callback(error)
      ipcRenderer.on('update:error', listener)
      return () => ipcRenderer.removeListener('update:error', listener)
    },
    onProgress: (callback: (progress: any) => void) => {
      const listener = (_: any, progress: any) => callback(progress)
      ipcRenderer.on('update:progress', listener)
      return () => ipcRenderer.removeListener('update:progress', listener)
    },
    onDownloaded: (callback: (info: any) => void) => {
      const listener = (_: any, info: any) => callback(info)
      ipcRenderer.on('update:downloaded', listener)
      return () => ipcRenderer.removeListener('update:downloaded', listener)
    }
  },
  // 数据备份
  backup: {
    create: (description?: string, userId?: string) => ipcRenderer.invoke('backup:create', description, userId),
    restore: (backupId: string) => ipcRenderer.invoke('backup:restore', backupId),
    delete: (backupId: string) => ipcRenderer.invoke('backup:delete', backupId),
    list: () => ipcRenderer.invoke('backup:list'),
    info: (backupId: string) => ipcRenderer.invoke('backup:info', backupId),
    export: (backupId: string, exportPath: string) => ipcRenderer.invoke('backup:export', backupId, exportPath),
    import: (importPath: string) => ipcRenderer.invoke('backup:import', importPath),
    getConfig: () => ipcRenderer.invoke('backup:get-config'),
    updateConfig: (newConfig: any) => ipcRenderer.invoke('backup:update-config', newConfig),
    autoBackup: () => ipcRenderer.invoke('backup:auto-backup')
  },
  // 监控和分析
  analytics: {
    trackUsage: (action: string, category: string, details?: any, duration?: number, userId?: string) => ipcRenderer.invoke('analytics:track-usage', action, category, details, duration, userId),
    trackPerformance: (name: string, value: number, unit?: string, details?: any, userId?: string) => ipcRenderer.invoke('analytics:track-performance', name, value, unit, details, userId),
    trackError: (message: string, category: string, severity: 'low' | 'medium' | 'high' | 'critical', stack?: string, context?: any, userId?: string) => ipcRenderer.invoke('analytics:track-error', message, category, severity, stack, context, userId),
    trackBehavior: (type: 'click' | 'scroll' | 'input' | 'navigation' | 'focus', element?: string, page?: string, details?: any, userId?: string) => ipcRenderer.invoke('analytics:track-behavior', type, element, page, details, userId),
    markErrorResolved: (errorId: string) => ipcRenderer.invoke('analytics:mark-error-resolved', errorId),
    report: () => ipcRenderer.invoke('analytics:report'),
    generateReport: (startDate?: number, endDate?: number) => ipcRenderer.invoke('analytics:generate-report', startDate, endDate),
    getUsageEvents: (userId?: string, limit?: number) => ipcRenderer.invoke('analytics:get-usage-events', userId, limit),
    getPerformanceMetrics: (limit?: number) => ipcRenderer.invoke('analytics:get-performance-metrics', limit),
    getErrorEvents: (resolved?: boolean, limit?: number) => ipcRenderer.invoke('analytics:get-error-events', resolved, limit),
    getBehaviorEvents: (userId?: string, limit?: number) => ipcRenderer.invoke('analytics:get-behavior-events', userId, limit),
    getSessionInfo: () => ipcRenderer.invoke('analytics:get-session-info'),
    cleanup: () => ipcRenderer.invoke('analytics:cleanup'),
    getConfig: () => ipcRenderer.invoke('analytics:get-config'),
    updateConfig: (newConfig: any) => ipcRenderer.invoke('analytics:update-config', newConfig),
    export: (format: 'json' | 'csv') => ipcRenderer.invoke('analytics:export', format)
  },
  // 许可证管理
  license: {
    activate: (licenseKey: string, userId?: string, organization?: string) => ipcRenderer.invoke('license:activate', licenseKey, userId, organization),
    validate: () => ipcRenderer.invoke('license:validate'),
    getCurrent: () => ipcRenderer.invoke('license:get-current'),
    getInfo: () => ipcRenderer.invoke('license:get-info'),
    hasFeature: (feature: string) => ipcRenderer.invoke('license:has-feature', feature),
    canCreateProject: (currentProjects: number) => ipcRenderer.invoke('license:can-create-project', currentProjects),
    canAddUser: (currentUsers: number) => ipcRenderer.invoke('license:can-add-user', currentUsers),
    assignSeat: (userId: string, username: string, email: string) => ipcRenderer.invoke('license:assign-seat', userId, username, email),
    releaseSeat: (userId: string) => ipcRenderer.invoke('license:release-seat', userId),
    getSeatAssignments: (licenseId?: string) => ipcRenderer.invoke('license:get-seat-assignments', licenseId),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    getConfig: () => ipcRenderer.invoke('license:get-config'),
    updateConfig: (newConfig: any) => ipcRenderer.invoke('license:update-config', newConfig),
    checkFeatures: (features: string[]) => ipcRenderer.invoke('license:check-features', features)
  },
  // 人机协作
  collab: {
    request: (data: {
      taskId: string
      phase: string
      title: string
      description: string
      content: any
      alternatives?: string[]
      editableParams?: string[]
    }) => ipcRenderer.invoke('collaboration:request', data),
    approve: (requestId: string, response?: string) => ipcRenderer.invoke('collaboration:approve', requestId, response),
    reject: (requestId: string, reason?: string) => ipcRenderer.invoke('collaboration:reject', requestId, reason),
    modify: (requestId: string, modifiedParams: any, response?: string) => ipcRenderer.invoke('collaboration:modify', requestId, modifiedParams, response),
    getPending: (taskId?: string) => ipcRenderer.invoke('collaboration:getPending', taskId),
    onRequest: (callback: (request: any) => void) => {
      const listener = (_: any, request: any) => callback(request)
      ipcRenderer.on('collaboration:request', listener)
      return () => ipcRenderer.removeListener('collaboration:request', listener)
    },
    onResponse: (callback: (request: any) => void) => {
      const listener = (_: any, request: any) => callback(request)
      ipcRenderer.on('collaboration:response', listener)
      return () => ipcRenderer.removeListener('collaboration:response', listener)
    }
  },
  // IPC Renderer for event listening
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
      const listener = (_: any, ...args: any[]) => callback(_, ...args)
      ipcRenderer.on(channel, listener)
    },
    removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback)
    }
  }
})

// 类型定义
declare global {
  interface Window {
    electron: {
      system: {
        openExternal: (url: string) => Promise<void>
        captureScreen: () => Promise<any>
        executeCommand: (command: string, args: string[]) => Promise<any>
        executeComplexCommand: (command: string, options?: any) => Promise<any>
        executeShellScript: (script: string, cwd?: string) => Promise<any>
        getSystemInfo: () => Promise<any>
      }
      dialog: {
        openFile: () => Promise<any>
        showOpenDialog: (options: any) => Promise<any>
      }
      tools: {
        listTools: () => Promise<{ success: boolean; tools?: string[]; error?: string }>
        detectTools: () => Promise<{ success: boolean; tools?: any[]; error?: string }>
        findPath: (toolId: string) => Promise<any>
        configureTool: (toolId: string, customPath: string) => Promise<any>
        getToolConfig: (toolId: string) => Promise<any>
        executeToolCommand: (tool: string, command: string, args: any[]) => Promise<any>
        buildProject: (path: string, tool: string, target: string) => Promise<void>
        openPath: (path: string, tool?: string) => Promise<void>
        vscode: {
          openProject: (projectPath: string) => Promise<any>
          createFile: (projectPath: string, fileName: string, content: string) => Promise<any>
          executeCommand: (command: string, args: string[]) => Promise<any>
        }
      }
      api: {
        setApiKey: (model: string, key: string) => Promise<void>
        getApiKey: (model: string) => Promise<string | null>
        testApiKey: (model: string, key: string) => Promise<boolean>
        readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
        writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
        getGitStatus: (projectPath: string) => Promise<{ success: boolean; status?: any; error?: string }>
        getPlanVersions: (projectPath: string) => Promise<{ success: boolean; versions?: any[]; error?: string }>
        commitPlan: (projectPath: string, message: string) => Promise<{ success: boolean; error?: string }>
        initGit: (projectPath: string) => Promise<{ success: boolean; error?: string }>
        restorePlanVersion: (projectPath: string, versionId: string) => Promise<{ success: boolean; error?: string }>
      }
      fs: {
        readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
        writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
        editFile: (path: string, oldContent: string, newContent: string) => Promise<{ success: boolean; error?: string }>
        compareFiles: (path1: string, path2: string) => Promise<{ success: boolean; isEqual?: boolean; error?: string }>
        exists: (path: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>
        listFiles: (path: string) => Promise<{ success: boolean; files?: string[]; error?: string }>
        listEntries: (dirPath: string) => Promise<{ success: boolean; entries?: { name: string; isDirectory: boolean; isFile: boolean }[]; error?: string }>
        listDirectories: (dirPath: string) => Promise<{ success: boolean; directories?: string[]; error?: string }>
        getProjectInfo: (projectPath: string) => Promise<{ success: boolean; project?: any; error?: string }>
        scanProjectsDirectory: (projectsDir: string) => Promise<{ success: boolean; projects?: any[]; error?: string }>
        runNpmScript: (projectPath: string, scriptName: string) => Promise<{ success: boolean; message?: string; error?: string }>
      }
      plugins: {
        listPlugins: () => Promise<{ success: boolean; plugins?: any[]; error?: string }>
        installPlugin: (url: string) => Promise<any>
        uninstallPlugin: (name: string) => Promise<any>
        updatePlugin: (name: string) => Promise<any>
        enablePlugin: (name: string) => Promise<any>
        disablePlugin: (name: string) => Promise<any>
        execute: (name: string, command: string, args: any[]) => Promise<any>
        get: (name: string) => Promise<any>
      }
      chat: {
        sendMessage: (model: string, message: string) => Promise<any>
        cancel: () => Promise<any>
        pause: () => Promise<any>
        resume: () => Promise<any>
      },
      web: {
        crawlPage: (url: string, options?: any) => Promise<any>
        submitForm: (url: string, formData: any, options?: any) => Promise<any>
        downloadFile: (url: string, savePath: string, options?: any) => Promise<any>
      },
      task: {
        execute: (instruction: string, options?: any) => Promise<any>
        cancel: () => Promise<any>
        onProgress: (callback: (evt: any) => void) => () => void
      },
      gallery: {
        list: () => Promise<any>
        import: (filePaths: string[]) => Promise<any>
        delete: (id: string) => Promise<any>
        getDataUrl: (filePath: string) => Promise<any>
        reveal: (filePath: string) => Promise<any>
        addTag: (id: string, tag: string) => Promise<any>
        removeTag: (id: string, tag: string) => Promise<any>
        renameItem: (id: string, newName: string) => Promise<any>
      },
      kb: {
        initialize: () => Promise<any>
        upload: (filePath: string) => Promise<any>
        list: () => Promise<any>
        delete: (docId: string) => Promise<any>
        search: (query: string) => Promise<any>
        extract: (docId: string) => Promise<any>
        get: (docId: string) => Promise<any>
      },
      code: {
        generate: (prompt: string, language: string, options?: any) => Promise<any>
        explain: (code: string, language: string, options?: any) => Promise<any>
        refactor: (code: string, language: string, options?: any) => Promise<any>
      },
      viz: {
        generate: (data: any, chartType: string, options?: any) => Promise<any>
        processData: (rawData: any, operation: string, options?: any) => Promise<any>
        analyze: (data: any, options?: any) => Promise<any>
      },
      preferences: {
        get: (section?: string) => Promise<any>
        set: (section: string, key: string, value: any) => Promise<any>
        setMultiple: (section: string, values: any) => Promise<any>
        reset: (section?: string) => Promise<any>
        export: () => Promise<any>
        import: (filePath: string) => Promise<any>
      },
      projectManager: {
        create: (data: any) => Promise<any>
        get: (projectId: string) => Promise<any>
        list: (filter?: any) => Promise<any>
        update: (projectId: string, updates: any) => Promise<any>
        delete: (projectId: string) => Promise<any>
        addTask: (data: any) => Promise<any>
        getTask: (taskId: string) => Promise<any>
        getTasks: (projectId: string) => Promise<any>
        updateTask: (taskId: string, updates: any) => Promise<any>
        deleteTask: (taskId: string) => Promise<any>
        addTaskComment: (taskId: string, author: string, content: string) => Promise<any>
        generateReport: (projectId: string, type: string, title: string) => Promise<any>
        getReports: (projectId: string) => Promise<any>
        getReport: (reportId: string) => Promise<any>
        estimateTime: (projectId: string) => Promise<any>
        trackProgress: (projectId: string) => Promise<any>
        setMode: (projectId: string, mode: string) => Promise<any>
        getMode: (projectId: string) => Promise<any>
        getStatistics: () => Promise<any>
      },
      library: {
        createDocument: (doc: any) => Promise<any>
        getDocument: (id: string) => Promise<any>
        updateDocument: (id: string, updates: any) => Promise<any>
        deleteDocument: (id: string) => Promise<any>
        searchDocuments: (query: any) => Promise<any>
        getDocumentHistory: (id: string) => Promise<any>
        restoreVersion: (id: string, version: number) => Promise<any>
        createPlan: (requirementId: string, metadata?: any) => Promise<any>
        getPlan: (planId: string) => Promise<any>
        updatePlan: (planId: string, updates: any) => Promise<any>
        getPlanProgress: (planId: string) => Promise<any>
        createDecision: (request: any) => Promise<any>
        getDecision: (decisionId: string) => Promise<any>
        makeDecision: (decisionId: string, optionId: string, reason?: string) => Promise<any>
        getPendingDecisions: (planId?: string) => Promise<any>
        startCollaboration: (request: any) => Promise<any>
        getCollaborationSession: (sessionId: string) => Promise<any>
        executePlan: (sessionId: string) => Promise<any>
        makeSessionDecision: (sessionId: string, decisionId: string, optionId: string, reason?: string) => Promise<any>
        cancelSession: (sessionId: string, reason?: string) => Promise<any>
        getSessionProgress: (sessionId: string) => Promise<any>
        getSessionPendingDecisions: (sessionId: string) => Promise<any>
      },
      auth: {
        login: (username: string, password: string) => Promise<any>
        register: (username: string, email: string, password: string) => Promise<any>
        checkUsername: (username: string) => Promise<{ success: boolean; available?: boolean; error?: string }>
        logout: (token: string) => Promise<any>
        verify: (token: string) => Promise<any>
        getCurrentUser: (token: string) => Promise<any>
        changePassword: (token: string, oldPassword: string, newPassword: string) => Promise<any>
        forgotPassword: (email: string) => Promise<any>
      }
    }
  }
}

// 类型定义
