import { contextBridge, ipcRenderer } from 'electron'

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
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile')
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
    setApiKey: (model: string, key: string) => ipcRenderer.invoke('api:setKey', model, key),
    getApiKey: (model: string) => ipcRenderer.invoke('api:getKey', model),
    testApiKey: (model: string, key: string) => ipcRenderer.invoke('api:testKey', model, key)
  },
  // 本地文件操作
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
    editFile: (path: string, oldContent: string, newContent: string) => ipcRenderer.invoke('fs:editFile', path, oldContent, newContent),
    compareFiles: (path1: string, path2: string) => ipcRenderer.invoke('fs:compareFiles', path1, path2),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    listFiles: (path: string) => ipcRenderer.invoke('fs:listFiles', path)
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
    cancel: () => ipcRenderer.invoke('chat:cancel')
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
    create: (name: string, type: string, options?: any) => ipcRenderer.invoke('projectManager:create', name, type, options),
    list: () => ipcRenderer.invoke('projectManager:list'),
    open: (projectId: string) => ipcRenderer.invoke('projectManager:open', projectId),
    close: (projectId: string) => ipcRenderer.invoke('projectManager:close', projectId),
    delete: (projectId: string) => ipcRenderer.invoke('projectManager:delete', projectId),
    addTask: (projectId: string, task: any) => ipcRenderer.invoke('projectManager:addTask', projectId, task),
    updateTask: (projectId: string, taskId: string, updates: any) => ipcRenderer.invoke('projectManager:updateTask', projectId, taskId, updates),
    deleteTask: (projectId: string, taskId: string) => ipcRenderer.invoke('projectManager:deleteTask', projectId, taskId),
    getTasks: (projectId: string) => ipcRenderer.invoke('projectManager:getTasks', projectId),
    generateReport: (projectId: string, reportType: string) => ipcRenderer.invoke('projectManager:generateReport', projectId, reportType),
    estimateTime: (projectId: string) => ipcRenderer.invoke('projectManager:estimateTime', projectId),
    trackProgress: (projectId: string) => ipcRenderer.invoke('projectManager:trackProgress', projectId),
    setMode: (mode: string) => ipcRenderer.invoke('projectManager:setMode', mode),
    getMode: () => ipcRenderer.invoke('projectManager:getMode')
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
      }
      tools: {
        listTools: () => Promise<string[]>
        detectTools: () => Promise<any[]>
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
      }
      fs: {
        readFile: (path: string) => Promise<string>
        writeFile: (path: string, content: string) => Promise<void>
        editFile: (path: string, oldContent: string, newContent: string) => Promise<any>
        compareFiles: (path1: string, path2: string) => Promise<any>
        exists: (path: string) => Promise<boolean>
        listFiles: (path: string) => Promise<string[]>
      }
      plugins: {
        listPlugins: () => Promise<any[]>
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
        create: (name: string, type: string, options?: any) => Promise<any>
        list: () => Promise<any>
        open: (projectId: string) => Promise<any>
        close: (projectId: string) => Promise<any>
        delete: (projectId: string) => Promise<any>
        addTask: (projectId: string, task: any) => Promise<any>
        updateTask: (projectId: string, taskId: string, updates: any) => Promise<any>
        deleteTask: (projectId: string, taskId: string) => Promise<any>
        getTasks: (projectId: string) => Promise<any>
        generateReport: (projectId: string, reportType: string) => Promise<any>
        estimateTime: (projectId: string) => Promise<any>
        trackProgress: (projectId: string) => Promise<any>
        setMode: (mode: string) => Promise<any>
        getMode: () => Promise<any>
      },
      events?: {
        onWebviewNewWindow: (callback: (details: { url: string; frameName?: string }) => void) => () => void
        onAgentOpenPage: (callback: (url: string) => void) => () => void
      }
    }
  }
}
