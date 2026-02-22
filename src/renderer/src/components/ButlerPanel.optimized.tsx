import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  FolderOpen, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  FileText, 
  Settings,
  RefreshCw,
  Download
} from 'lucide-react'

interface Project {
  id: string
  name: string
  path: string
  type: string
  createdAt: number
  lastModified: number
  status: 'creating' | 'created' | 'failed' | 'abandoned'
  files: ProjectFile[]
  description?: string
}

interface ProjectFile {
  path: string
  size: number
  type: 'file' | 'directory'
  lastModified: number
}

interface Problem {
  id: string
  type: string
  severity: string
  status: string
  message: string
  details?: string
  timestamp: number
  sourceAgent: string
  sourcePhase: string
  attempts: number
  maxAttempts: number
}

interface Solution {
  problemId: string
  type: string
  description: string
  steps: string[]
  executed: boolean
  success?: boolean
  timestamp: number
}

export function ButlerPanel() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [solution, setSolution] = useState<Solution | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  
  const loadingRef = useRef(false)
  const lastUpdateTime = useRef(0)

  const loadData = useCallback(async () => {
    if (loadingRef.current) return
    
    const now = Date.now()
    if (now - lastUpdateTime.current < 2000) return // 防抖：2秒内不重复加载
    
    loadingRef.current = true
    lastUpdateTime.current = now
    
    try {
      const [projectsRes, activeProjectRes, problemsRes] = await Promise.all([
        window.electron.butler.getAllProjects(),
        window.electron.butler.getActiveProject(),
        window.electron.butler.getAllProblems()
      ])

      if (projectsRes.success) {
        setProjects(projectsRes.projects)
      }
      if (activeProjectRes.success) {
        setActiveProject(activeProjectRes.project)
      }
      if (problemsRes.success) {
        setProblems(problemsRes.problems)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadData()
    
    let interval: NodeJS.Timeout | null = null
    
    if (autoRefresh) {
      interval = setInterval(loadData, 30000) // 降低频率到30秒
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [loadData, autoRefresh])

  const handleSelectProject = useCallback(async (project: Project) => {
    setActiveProject(project)
    setSelectedProblem(null)
    setSolution(null)
  }, [])

  const handleSelectProblem = useCallback(async (problem: Problem) => {
    setSelectedProblem(problem)
    try {
      const solutionRes = await window.electron.butler.getSolution(problem.id)
      if (solutionRes.success) {
        setSolution(solutionRes.solution)
      }
    } catch (error) {
      console.error('获取解决方案失败:', error)
    }
  }, [])

  const handleFixProblem = useCallback(async (problemId: string) => {
    setLoading(true)
    try {
      const result = await window.electron.butler.fixProblem(problemId)
      if (result.success) {
        await loadData()
        if (selectedProblem) {
          await handleSelectProblem(selectedProblem)
        }
      }
    } catch (error) {
      console.error('修复问题失败:', error)
    } finally {
      setLoading(false)
    }
  }, [loadData, selectedProblem, handleSelectProblem])

  const handleDownloadReport = useCallback(async (projectId: string) => {
    try {
      const reportRes = await window.electron.butler.getProjectReport(projectId)
      if (reportRes.success) {
        const blob = new Blob([reportRes.report], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `project-report-${projectId}.md`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('下载报告失败:', error)
    }
  }, [])

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }, [])

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-500'
      case 'escalated': return 'bg-red-500'
      case 'resolving': return 'bg-blue-500'
      case 'diagnosing': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }, [])

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }, [])

  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">智能管家</h1>
          <p className="text-muted-foreground mt-1">项目追踪和问题管理系统</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
          >
            {autoRefresh ? '自动刷新: 开' : '自动刷新: 关'}
          </Button>
          <Button onClick={loadData} variant="outline" size="icon" disabled={loadingRef.current}>
            <RefreshCw className={`h-4 w-4 ${loadingRef.current ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projects">项目列表</TabsTrigger>
          <TabsTrigger value="problems">问题列表</TabsTrigger>
          <TabsTrigger value="report">项目报告</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <div className="grid gap-4">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className={`cursor-pointer transition-all ${activeProject?.id === project.id ? 'ring-2 ring-primary' : ''}`} 
                onClick={() => handleSelectProject(project)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                    </div>
                    <Badge variant={project.status === 'created' ? 'default' : 'secondary'}>
                      {project.status === 'created' ? '已完成' : project.status === 'creating' ? '创建中' : '失败'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>创建时间: {formatTime(project.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>文件数: {project.files.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>路径: {project.path}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="problems" className="space-y-4">
          <div className="grid gap-4">
            {problems.map((problem) => (
              <Card 
                key={problem.id} 
                className={`cursor-pointer transition-all ${selectedProblem?.id === problem.id ? 'ring-2 ring-primary' : ''}`} 
                onClick={() => handleSelectProblem(problem)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className={`h-5 w-5 ${problem.status === 'resolved' ? 'text-green-500' : 'text-orange-500'}`} />
                      <CardTitle className="text-lg">{problem.message}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(problem.severity)}>
                        {problem.severity}
                      </Badge>
                      <Badge className={getStatusColor(problem.status)}>
                        {problem.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="text-muted-foreground">
                      <div>类型: {problem.type}</div>
                      <div>来源: {problem.sourceAgent} - {problem.sourcePhase}</div>
                      <div>时间: {formatTime(problem.timestamp)}</div>
                      <div>尝试次数: {problem.attempts}/{problem.maxAttempts}</div>
                    </div>
                    {problem.details && (
                      <Alert>
                        <AlertDescription className="text-xs">
                          {problem.details}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          {activeProject ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>项目报告 - {activeProject.name}</CardTitle>
                  <Button onClick={() => handleDownloadReport(activeProject.id)} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    下载报告
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold mb-2">基本信息</h3>
                      <div className="space-y-1 text-sm">
                        <div>项目ID: {activeProject.id}</div>
                        <div>项目类型: {activeProject.type}</div>
                        <div>创建时间: {formatTime(activeProject.createdAt)}</div>
                        <div>最后修改: {formatTime(activeProject.lastModified)}</div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">文件统计</h3>
                      <div className="space-y-1 text-sm">
                        <div>文件总数: {activeProject.files.length}</div>
                        <div>总大小: {formatFileSize(activeProject.files.reduce((sum, f) => sum + f.size, 0))}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">文件列表</h3>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {activeProject.files.map((file, index) => (
                        <div key={index} className="text-sm flex items-center gap-2">
                          {file.type === 'directory' ? (
                            <FolderOpen className="h-4 w-4 text-blue-500" />
                          ) : (
                            <FileText className="h-4 w-4 text-gray-500" />
                          )}
                          <span className="flex-1 truncate">{file.path}</span>
                          <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>未选择项目</AlertTitle>
              <AlertDescription>
                请先在项目列表中选择一个项目
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {selectedProblem && solution && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>解决方案</CardTitle>
              {solution.executed ? (
                <Badge variant={solution.success ? 'default' : 'destructive'}>
                  {solution.success ? '已解决' : '失败'}
                </Badge>
              ) : (
                <Button onClick={() => handleFixProblem(selectedProblem.id)} disabled={loading}>
                  {loading ? '修复中...' : '执行修复'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">描述</h3>
                <p className="text-sm text-muted-foreground">{solution.description}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">执行步骤</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {solution.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
