const { ipcMain } = require('electron')
const { MultiDialogueCoordinator } = require('./dist/main/agent/MultiDialogueCoordinator')
const path = require('path')
const fs = require('fs')

async function testMultiAgentSystem() {
  console.log('🧪 开始测试多智能体协作系统...\n')

  const coordinator = new MultiDialogueCoordinator()

  const testTask = `创建一个简单的待办事项应用，要求：
1. 使用React和TypeScript
2. 支持添加、删除、标记完成待办事项
3. 数据存储在localStorage中
4. 界面简洁美观
5. 包含基本的错误处理`

  console.log('📋 测试任务:', testTask)
  console.log('=====================================\n')

  try {
    const result = await coordinator.startDialogue(testTask, {
      maxRounds: 3,
      enableAutoIteration: true
    })

    console.log('\n=====================================')
    console.log('✅ 测试完成！')
    console.log('=====================================')
    console.log('最终结果:', result)
    console.log('\n检查项目文件夹是否创建...')
    
    const desktopPath = path.join(require('os').homedir(), 'Desktop')
    const projectDirs = fs.readdirSync(desktopPath).filter(dir => 
      dir.includes('todo') || dir.includes('待办')
    )
    
    console.log('找到的项目文件夹:', projectDirs)
    
    if (projectDirs.length > 0) {
      const projectPath = path.join(desktopPath, projectDirs[0])
      console.log('\n📁 项目路径:', projectPath)
      console.log('\n📂 项目结构:')
      const structure = await getDirectoryStructure(projectPath)
      console.log(structure)
      
      console.log('\n🔍 检查关键文件:')
      const keyFiles = ['package.json', 'src', 'tsconfig.json', 'vite.config.ts']
      for (const file of keyFiles) {
        const filePath = path.join(projectPath, file)
        if (fs.existsSync(filePath)) {
          console.log(`  ✅ ${file} 存在`)
        } else {
          console.log(`  ❌ ${file} 不存在`)
        }
      }
    } else {
      console.log('❌ 未找到项目文件夹')
    }

  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

async function getDirectoryStructure(dir, prefix = '') {
  let result = ''
  const files = fs.readdirSync(dir)
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const filePath = path.join(dir, file)
    const isLast = i === files.length - 1
    const connector = isLast ? '└── ' : '├── '
    
    result += prefix + connector + file + '\n'
    
    if (fs.statSync(filePath).isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ')
      result += await getDirectoryStructure(filePath, newPrefix)
    }
  }
  
  return result
}

testMultiAgentSystem()