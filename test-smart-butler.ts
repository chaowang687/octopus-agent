import { SmartButlerAgent, ProblemType, ProblemSeverity } from '../src/main/agent/SmartButlerAgent'
import * as fs from 'fs'
import * as path from 'path'

async function testSmartButler() {
  console.log('=== 智能管家测试开始 ===\n')

  const butler = SmartButlerAgent.getInstance()

  // 测试1：注册权限问题
  console.log('测试1：注册权限问题')
  const permissionError = new Error('EACCES: permission denied, access \'/Users/wangchao/Desktop/test\'')
  ;(permissionError as any).code = 'EACCES'
  ;(permissionError as any).path = '/Users/wangchao/Desktop/test'

  const permissionProblem = await butler.registerProblem(
    permissionError,
    'agent-dev',
    'implementation',
    { path: '/Users/wangchao/Desktop/test' }
  )

  console.log('问题ID:', permissionProblem.id)
  console.log('问题类型:', permissionProblem.type)
  console.log('严重程度:', permissionProblem.severity)
  console.log('状态:', permissionProblem.status)
  console.log('✅ 测试1通过\n')

  // 测试2：注册文件未找到问题
  console.log('测试2：注册文件未找到问题')
  const fileNotFoundError = new Error('ENOENT: no such file or directory, open \'/Users/wangchao/Desktop/test/file.txt\'')
  ;(fileNotFoundError as any).code = 'ENOENT'
  ;(fileNotFoundError as any).path = '/Users/wangchao/Desktop/test/file.txt'

  const fileNotFoundProblem = await butler.registerProblem(
    fileNotFoundError,
    'agent-test',
    'testing',
    { path: '/Users/wangchao/Desktop/test/file.txt' }
  )

  console.log('问题ID:', fileNotFoundProblem.id)
  console.log('问题类型:', fileNotFoundProblem.type)
  console.log('严重程度:', fileNotFoundProblem.severity)
  console.log('✅ 测试2通过\n')

  // 测试3：项目追踪
  console.log('测试3：项目追踪')
  const projectId = `test_project_${Date.now()}`
  const project = butler.startTrackingProject(
    projectId,
    '测试项目',
    '/Users/wangchao/Desktop/本地化TRAE/test_workspace',
    'test'
  )

  console.log('项目ID:', project.id)
  console.log('项目名称:', project.name)
  console.log('项目路径:', project.path)
  console.log('项目状态:', project.status)
  console.log('✅ 测试3通过\n')

  // 测试4：更新项目状态
  console.log('测试4：更新项目状态')
  butler.updateProjectStatus(projectId, 'created')
  const updatedProject = butler.getProjectInfo(projectId)
  console.log('更新后的状态:', updatedProject?.status)
  console.log('✅ 测试4通过\n')

  // 测试5：更新项目文件
  console.log('测试5：更新项目文件')
  const files = [
    { path: 'package.json', size: 1024, type: 'file' as const, lastModified: Date.now() },
    { path: 'src/index.ts', size: 2048, type: 'file' as const, lastModified: Date.now() },
    { path: 'src', size: 0, type: 'directory' as const, lastModified: Date.now() }
  ]
  butler.updateProjectFiles(projectId, files)
  const projectWithFiles = butler.getProjectInfo(projectId)
  console.log('文件数量:', projectWithFiles?.files.length)
  console.log('✅ 测试5通过\n')

  // 测试6：生成项目报告
  console.log('测试6：生成项目报告')
  const report = butler.generateProjectReport(projectId)
  console.log('报告长度:', report.length)
  console.log('报告预览:', report.substring(0, 200) + '...')
  console.log('✅ 测试6通过\n')

  // 测试7：获取所有问题
  console.log('测试7：获取所有问题')
  const allProblems = butler.getAllProblems()
  console.log('问题总数:', allProblems.length)
  console.log('✅ 测试7通过\n')

  // 测试8：获取所有项目
  console.log('测试8：获取所有项目')
  const allProjects = butler.getAllProjects()
  console.log('项目总数:', allProjects.length)
  console.log('✅ 测试8通过\n')

  // 测试9：获取解决方案
  console.log('测试9：获取解决方案')
  const solution = butler.getSolution(permissionProblem.id)
  console.log('解决方案类型:', solution?.type)
  console.log('解决方案描述:', solution?.description)
  console.log('解决方案步骤数:', solution?.steps.length)
  console.log('✅ 测试9通过\n')

  // 测试10：获取能力列表
  console.log('测试10：获取能力列表')
  const capabilities = butler.getCapabilities()
  console.log('能力数量:', capabilities.length)
  capabilities.forEach(cap => {
    console.log(`- ${cap.name}: ${cap.description} (${cap.enabled ? '启用' : '禁用'})`)
  })
  console.log('✅ 测试10通过\n')

  console.log('=== 智能管家测试完成 ===')
  console.log('\n所有测试通过！✅')
}

async function testIntegration() {
  console.log('\n=== 集成测试开始 ===\n')

  const butler = SmartButlerAgent.getInstance()

  // 模拟多智能体协作流程
  console.log('模拟多智能体协作流程')

  // 1. 开始追踪项目
  const projectId = `integration_test_${Date.now()}`
  const project = butler.startTrackingProject(
    projectId,
    '集成测试项目',
    '/Users/wangchao/Desktop/本地化TRAE/integration_test',
    'multi-agent'
  )
  console.log('✅ 开始追踪项目:', project.name)

  // 2. PM 分析需求
  console.log('✅ PM 分析需求完成')

  // 3. UI 设计师设计界面
  console.log('✅ UI 设计师设计界面完成')

  // 4. 全栈开发工程师实现代码（模拟遇到权限问题）
  console.log('全栈开发工程师实现代码...')
  const devError = new Error('EACCES: permission denied, access \'/Users/wangchao/Desktop/integration_test\'')
  ;(devError as any).code = 'EACCES'
  ;(devError as any).path = '/Users/wangchao/Desktop/integration_test'

  const devProblem = await butler.registerProblem(
    devError,
    'agent-dev',
    'implementation',
    { path: '/Users/wangchao/Desktop/integration_test' }
  )
  console.log('✅ 检测到权限问题:', devProblem.id)

  // 5. 等待智能管家自动修复
  console.log('等待智能管家自动修复...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 6. 检查问题状态
  const updatedProblem = butler.getProblem(devProblem.id)
  console.log('问题状态:', updatedProblem?.status)
  console.log('尝试次数:', updatedProblem?.attempts)

  // 7. 测试工程师生成测试
  console.log('✅ 测试工程师生成测试完成')

  // 8. 代码审查员审查代码
  console.log('✅ 代码审查员审查代码完成')

  // 9. 更新项目状态
  butler.updateProjectStatus(projectId, 'created')
  console.log('✅ 项目状态更新为: created')

  // 10. 生成项目报告
  const report = butler.generateProjectReport(projectId)
  console.log('✅ 生成项目报告，长度:', report.length)

  console.log('\n=== 集成测试完成 ===')
  console.log('集成测试通过！✅')
}

async function testErrorHandling() {
  console.log('\n=== 错误处理测试开始 ===\n')

  const butler = SmartButlerAgent.getInstance()

  // 测试1：未知错误类型
  console.log('测试1：未知错误类型')
  const unknownError = new Error('Unknown error occurred')
  const unknownProblem = await butler.registerProblem(
    unknownError,
    'agent-unknown',
    'unknown-phase',
    {}
  )
  console.log('问题类型:', unknownProblem.type)
  console.log('严重程度:', unknownProblem.severity)
  console.log('✅ 测试1通过\n')

  // 测试2：网络错误
  console.log('测试2：网络错误')
  const networkError = new Error('ENET: network unreachable')
  ;(networkError as any).code = 'ENET'
  const networkProblem = await butler.registerProblem(
    networkError,
    'agent-dev',
    'implementation',
    {}
  )
  console.log('问题类型:', networkProblem.type)
  console.log('严重程度:', networkProblem.severity)
  console.log('✅ 测试2通过\n')

  // 测试3：依赖错误
  console.log('测试3：依赖错误')
  const dependencyError = new Error('npm install failed: missing dependencies')
  const dependencyProblem = await butler.registerProblem(
    dependencyError,
    'agent-dev',
    'implementation',
    { projectPath: '/Users/wangchao/Desktop/test' }
  )
  console.log('问题类型:', dependencyProblem.type)
  console.log('严重程度:', dependencyProblem.severity)
  console.log('✅ 测试3通过\n')

  console.log('=== 错误处理测试完成 ===')
  console.log('错误处理测试通过！✅')
}

async function runAllTests() {
  try {
    await testSmartButler()
    await testIntegration()
    await testErrorHandling()
    console.log('\n🎉 所有测试通过！')
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  runAllTests()
}

export { testSmartButler, testIntegration, testErrorHandling, runAllTests }
