export interface ElectronAPI {
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
    listTools: () => Promise<any>
    detectTools: () => Promise<any>
    findPath: (toolId: string) => Promise<string>
    configureTool: (toolId: string, customPath: string) => Promise<void>
    getToolConfig: (toolId: string) => Promise<any>
    executeToolCommand: (tool: string, command: string, args: any[]) => Promise<any>
    buildProject: (path: string, tool: string, target: string) => Promise<any>
    openPath: (path: string, tool?: string) => Promise<void>
    vscode: {
      openProject: (projectPath: string) => Promise<void>
      createFile: (projectPath: string, fileName: string, content: string) => Promise<void>
      executeCommand: (command: string, args: string[]) => Promise<any>
    }
  }
  api: {
    setApiKey: (model: string, key: string, userId?: string) => Promise<void>
    getApiKey: (model: string, userId?: string) => Promise<string>
    deleteApiKey: (model: string, userId?: string) => Promise<void>
    testApiKey: (model: string, key: string) => Promise<any>
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    getGitStatus: (projectPath: string) => Promise<any>
    getPlanVersions: (projectPath: string) => Promise<any>
    commitPlan: (projectPath: string, message: string) => Promise<void>
    initGit: (projectPath: string) => Promise<void>
    restorePlanVersion: (projectPath: string, versionId: string) => Promise<void>
  }
  fs: {
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    exists: (path: string) => Promise<boolean>
    mkdir: (path: string) => Promise<void>
    readdir: (path: string) => Promise<string[]>
  }
  task: {
    execute: (instruction: string, options?: any) => Promise<any>
    cancel: (taskId?: string) => Promise<void>
    getStatus: (taskId: string) => Promise<any>
    onProgress: (callback: (evt: any) => void) => () => void
  }
  chat: {
    sendMessage: (message: string, sessionId: string) => Promise<any>
    cancel: () => Promise<any>
    pause: () => Promise<any>
    resume: () => Promise<any>
  }
  project: {
    create: (name: string, path: string) => Promise<any>
    list: () => Promise<any>
    get: (id: string) => Promise<any>
    update: (id: string, data: any) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  library: {
    createDocument: (doc: any) => Promise<any>
    getDocument: (id: string) => Promise<any>
    updateDocument: (id: string, updates: any) => Promise<any>
    deleteDocument: (id: string) => Promise<void>
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
    cancelSession: (sessionId: string, reason?: string) => Promise<void>
    getSessionProgress: (sessionId: string) => Promise<any>
    getSessionPendingDecisions: (sessionId: string) => Promise<any>
  }
  collaboration: {
    onEvent: (callback: (event: any) => void) => void
    offEvent: () => void
    approve: (requestId: string, response?: string) => Promise<any>
    reject: (requestId: string, reason?: string) => Promise<any>
    modify: (requestId: string, modifiedParams: any, response?: string) => Promise<any>
  }
  omni: {
    executeTask: (instruction: string, options?: any) => Promise<any>
    getTaskStatus: (taskId: string) => Promise<any>
    getTaskHistory: () => Promise<any>
    clearTaskHistory: () => Promise<any>
    addProject: (project: any) => Promise<any>
    getProject: (projectId: string) => Promise<any>
    getAllProjects: () => Promise<any>
    switchProject: (projectId: string) => Promise<any>
    removeProject: (projectId: string) => Promise<any>
    setPermissionLevel: (level: string) => Promise<any>
    getPermissionLevel: () => Promise<any>
    hasPermission: (requiredLevel: string) => Promise<any>
    getPermissionLog: () => Promise<any>
    isBusy: () => Promise<any>
    getCurrentTaskId: () => Promise<any>
    getAgentType: () => Promise<any>
    healthCheck: () => Promise<any>
    subscribe: (eventType: string) => void
  }
  auth: {
    login: (username: string, password: string) => Promise<any>
    logout: (token: string) => Promise<any>
    verify: (token: string) => Promise<any>
    getCurrentUser: (token: string) => Promise<any>
    changePassword: (token: string, oldPassword: string, newPassword: string) => Promise<any>
  }
  user: {
    getAll: (token: string) => Promise<any>
    create: (token: string, username: string, email: string, password: string, role: 'admin' | 'user' | 'guest') => Promise<any>
    update: (token: string, userId: string, updates: any) => Promise<any>
    delete: (token: string, userId: string) => Promise<any>
    setProjectPermission: (token: string, userId: string, projectId: string, role: 'owner' | 'editor' | 'viewer') => Promise<any>
    checkProjectPermission: (token: string, projectId: string, requiredRole: 'owner' | 'editor' | 'viewer') => Promise<any>
  }
  update: {
    check: () => Promise<any>
    download: () => Promise<any>
    install: () => Promise<any>
    getInfo: () => Promise<any>
    onChecking: (callback: () => void) => () => void
    onAvailable: (callback: (info: any) => void) => () => void
    onNotAvailable: (callback: (info: any) => void) => () => void
    onError: (callback: (error: any) => void) => () => void
    onProgress: (callback: (progress: any) => void) => () => void
    onDownloaded: (callback: (info: any) => void) => () => void
  }
  backup: {
    create: (description?: string, userId?: string) => Promise<any>
    restore: (backupId: string) => Promise<any>
    delete: (backupId: string) => Promise<any>
    list: () => Promise<any>
    info: (backupId: string) => Promise<any>
    export: (backupId: string, exportPath: string) => Promise<any>
    import: (importPath: string) => Promise<any>
    getConfig: () => Promise<any>
    updateConfig: (newConfig: any) => Promise<any>
    autoBackup: () => Promise<any>
  }
  analytics: {
    trackUsage: (action: string, category: string, details?: any, duration?: number, userId?: string) => Promise<any>
    trackPerformance: (name: string, value: number, unit?: string, details?: any, userId?: string) => Promise<any>
    trackError: (message: string, category: string, severity: 'low' | 'medium' | 'high' | 'critical', stack?: string, context?: any, userId?: string) => Promise<any>
    trackBehavior: (type: 'click' | 'scroll' | 'input' | 'navigation' | 'focus', element?: string, page?: string, details?: any, userId?: string) => Promise<any>
    markErrorResolved: (errorId: string) => Promise<any>
    report: () => Promise<any>
    generateReport: (startDate?: number, endDate?: number) => Promise<any>
    getUsageEvents: (userId?: string, limit?: number) => Promise<any>
    getPerformanceMetrics: (limit?: number) => Promise<any>
    getErrorEvents: (resolved?: boolean, limit?: number) => Promise<any>
    getBehaviorEvents: (userId?: string, limit?: number) => Promise<any>
    getSessionInfo: () => Promise<any>
    cleanup: () => Promise<any>
    getConfig: () => Promise<any>
    updateConfig: (newConfig: any) => Promise<any>
    export: (format: 'json' | 'csv') => Promise<any>
  }
  license: {
    activate: (licenseKey: string, userId?: string, organization?: string) => Promise<any>
    validate: () => Promise<any>
    getCurrent: () => Promise<any>
    getInfo: () => Promise<any>
    hasFeature: (feature: string) => Promise<any>
    canCreateProject: (currentProjects: number) => Promise<any>
    canAddUser: (currentUsers: number) => Promise<any>
    assignSeat: (userId: string, username: string, email: string) => Promise<any>
    releaseSeat: (userId: string) => Promise<any>
    getSeatAssignments: (licenseId?: string) => Promise<any>
    deactivate: () => Promise<any>
    getConfig: () => Promise<any>
    updateConfig: (newConfig: any) => Promise<any>
    checkFeatures: (features: string[]) => Promise<any>
  }
  ipcRenderer: {
    on: (channel: string, callback: (event: any, ...args: any[]) => void) => void
    removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {}
