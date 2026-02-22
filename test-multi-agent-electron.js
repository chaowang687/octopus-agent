const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow = null

async function testMultiAgent() {
  console.log('🧪 开始测试多智能体协作系统...\n')
  
  app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'dist/preload/index.js')
      }
    })

    mainWindow.loadURL('http://localhost:5173')

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ 应用加载完成')
      
      setTimeout(() => {
        const testTask = `创建一个简单的待办事项应用，要求：
1. 使用React和TypeScript
2. 支持添加、删除、标记完成待办事项
3. 数据存储在localStorage中
4. 界面简洁美观
5. 包含基本的错误处理`

        console.log('📋 发送测试任务:', testTask)
        console.log('=====================================\n')
        
        mainWindow.webContents.send('test:multi-agent', testTask)
      }, 2000)
    })
  })

  ipcMain.on('test:progress', (event, data) => {
    console.log(`[${data.agent}] ${data.message}`)
    if (data.reasoning) {
      console.log(`  🧠 推理: ${data.reasoning}`)
    }
    if (data.correction) {
      console.log(`  🔧 纠错: ${data.correction}`)
    }
  })

  ipcMain.on('test:complete', (event, data) => {
    console.log('\n=====================================')
    console.log('✅ 测试完成！')
    console.log('=====================================')
    console.log('项目路径:', data.projectPath)
    console.log('执行时间:', data.duration + 'ms')
    console.log('迭代轮数:', data.rounds)
    
    setTimeout(() => {
      app.quit()
    }, 2000)
  })

  ipcMain.on('test:error', (event, error) => {
    console.error('❌ 测试失败:', error)
    app.quit()
  })
}

testMultiAgent()