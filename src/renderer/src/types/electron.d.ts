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
    setApiKey: (model: string, key: string) => Promise<void>
    getApiKey: (model: string) => Promise<string>
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
    cancel: (taskId: string) => Promise<void>
    getStatus: (taskId: string) => Promise<any>
  }
  chat: {
    sendMessage: (message: string, sessionId: string) => Promise<any>
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
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {}
