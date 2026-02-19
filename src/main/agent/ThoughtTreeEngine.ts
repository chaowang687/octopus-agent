/**
 * 思维树（Tree-of-Thought）推理引擎
 * 实现分支推理、回溯机制、并行推理和动态推理深度调整
 */

import { EventEmitter } from 'events'
import { llmService, LLMMessage } from '../services/LLMService'
import { ErrorHandler } from '../utils/ErrorHandler'
import { ReActStep, ReActStepType, ReActTrace, ReActOptions } from './ReActEngine'

// ============================================
// 思维树节点
// ============================================
export interface ThoughtNode {
  id: string
  parentId: string | null
  depth: number
  thought: string
  action?: string
  actionInput?: any
  observation?: string
  confidence: number
  status: 'pending' | 'exploring' | 'completed' | 'failed' | 'pruned'
  children: ThoughtNode[]
  timestamp: number
  metadata?: {
    reasoning?: string
    alternatives?: string[]
    estimatedValue?: number
  }
}

// ============================================
// 思维树
// ============================================
export interface ThoughtTree {
  id: string
  task: string
  root: ThoughtNode
  nodes: Map<string, ThoughtNode>
  maxDepth: number
  currentDepth: number
  totalNodes: number
  prunedNodes: number
  bestPath: ThoughtNode[]
  createdAt: number
  completedAt?: number
}

// ============================================
// 分支策略
// ============================================
export interface BranchStrategy {
  type: 'exhaustive' | 'beam' | 'best_first' | 'adaptive'
  beamWidth?: number
  maxBranches?: number
  confidenceThreshold?: number
  diversityBonus?: number
}

// ============================================
// 回溯决策
// ============================================
export interface BacktrackDecision {
  nodeId: string
  reason: 'dead_end' | 'low_confidence' | 'better_path_found' | 'timeout'
  alternativeNodeId?: string
  confidence: number
  timestamp: number
}

// ============================================
// 思维树引擎选项
// ============================================
export interface ToTOptions extends ReActOptions {
  maxDepth?: number
  branchStrategy?: BranchStrategy
  enableBacktracking?: boolean
  enableParallelExploration?: boolean
  maxParallelBranches?: number
  pruningThreshold?: number
  diversityWeight?: number
  confidenceWeight?: number
  efficiencyWeight?: number
}

// ============================================
// 思维树引擎类
// ============================================
export class ThoughtTreeEngine extends EventEmitter {
  private defaultOptions: ToTOptions = {
    maxIterations: 10,
    maxTokens: 4000,
    temperature: 0.7,
    maxDepth: 5,
    branchStrategy: {
      type: 'adaptive',
      beamWidth: 3,
      maxBranches: 5,
      confidenceThreshold: 0.3,
      diversityBonus: 0.2
    },
    enableBacktracking: true,
    enableParallelExploration: true,
    maxParallelBranches: 3,
    pruningThreshold: 0.2,
    diversityWeight: 0.3,
    confidenceWeight: 0.4,
    efficiencyWeight: 0.3
  }

  constructor() {
    super()
  }

  // ============================================
  // 主要执行方法
  // ============================================
  
  async execute(
    task: string,
    options: ToTOptions = {},
    onNodeUpdate?: (node: ThoughtNode, tree: ThoughtTree) => void | Promise<void>
  ): Promise<ThoughtTree> {
    const opts = { ...this.defaultOptions, ...options }
    const startTime = Date.now()
    
    const tree: ThoughtTree = {
      id: `tot_${Date.now()}`,
      task,
      root: this.createRootNode(task),
      nodes: new Map(),
      maxDepth: opts.maxDepth || 5,
      currentDepth: 0,
      totalNodes: 1,
      prunedNodes: 0,
      bestPath: [],
      createdAt: startTime
    }
    
    tree.nodes.set(tree.root.id, tree.root)
    
    this.emit('start', { treeId: tree.id, task })
    
    try {
      if (opts.enableParallelExploration) {
        await this.exploreParallel(tree, opts, onNodeUpdate)
      } else {
        await this.exploreSequential(tree, opts, onNodeUpdate)
      }
      
      tree.bestPath = this.findBestPath(tree, opts)
      tree.completedAt = Date.now()
      
      this.emit('complete', { tree, success: true })
      
      return tree
    } catch (error: any) {
      const appError = ErrorHandler.handleError(error, {
        component: 'ThoughtTreeEngine',
        operation: 'execute'
      })
      
      tree.completedAt = Date.now()
      this.emit('error', { error: appError, treeId: tree.id })
      
      return tree
    }
  }

  // ============================================
  // 节点创建和管理
  // ============================================
  
  private createRootNode(task: string): ThoughtNode {
    return {
      id: 'root',
      parentId: null,
      depth: 0,
      thought: `Initial thought: ${task}`,
      confidence: 1.0,
      status: 'completed',
      children: [],
      timestamp: Date.now(),
      metadata: {
        reasoning: 'Starting point for reasoning',
        estimatedValue: 0.5
      }
    }
  }

  private createChildNode(
    parent: ThoughtNode,
    thought: string,
    action?: string,
    actionInput?: any,
    confidence: number = 0.5
  ): ThoughtNode {
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    
    const node: ThoughtNode = {
      id: nodeId,
      parentId: parent.id,
      depth: parent.depth + 1,
      thought,
      action,
      actionInput,
      confidence,
      status: 'pending',
      children: [],
      timestamp: Date.now(),
      metadata: {
        estimatedValue: confidence
      }
    }
    
    parent.children.push(node)
    return node
  }

  // ============================================
  // 顺序探索
  // ============================================
  
  private async exploreSequential(
    tree: ThoughtTree,
    options: ToTOptions,
    onNodeUpdate?: (node: ThoughtNode, tree: ThoughtTree) => void | Promise<void>
  ): Promise<void> {
    const strategy = options.branchStrategy || this.defaultOptions.branchStrategy!
    const nodesToExplore: ThoughtNode[] = [tree.root]
    
    while (nodesToExplore.length > 0) {
      const currentNode = nodesToExplore.shift()!
      
      if (currentNode.depth >= tree.maxDepth) {
        continue
      }
      
      currentNode.status = 'exploring'
      
      if (onNodeUpdate) await onNodeUpdate(currentNode, tree)
      
      const children = await this.generateChildren(currentNode, tree, options)
      
      for (const child of children) {
        tree.nodes.set(child.id, child)
        tree.totalNodes++
        
        if (onNodeUpdate) await onNodeUpdate(child, tree)
      }
      
      const selectedChildren = this.selectChildren(children, strategy)
      
      for (const child of selectedChildren) {
        child.status = 'completed'
        nodesToExplore.push(child)
      }
      
      const prunedChildren = children.filter(c => !selectedChildren.includes(c))
      for (const child of prunedChildren) {
        child.status = 'pruned'
        tree.prunedNodes++
      }
      
      currentNode.status = 'completed'
      
      if (options.enableBacktracking) {
        const backtrackDecision = this.shouldBacktrack(tree, currentNode, options)
        if (backtrackDecision) {
          await this.performBacktrack(tree, backtrackDecision, options)
        }
      }
    }
  }

  // ============================================
  // 并行探索
  // ============================================
  
  private async exploreParallel(
    tree: ThoughtTree,
    options: ToTOptions,
    onNodeUpdate?: (node: ThoughtNode, tree: ThoughtTree) => void | Promise<void>
  ): Promise<void> {
    const strategy = options.branchStrategy || this.defaultOptions.branchStrategy!
    const maxParallel = options.maxParallelBranches || 3
    const nodesToExplore: ThoughtNode[] = [tree.root]
    
    while (nodesToExplore.length > 0) {
      const batch = nodesToExplore.splice(0, maxParallel)
      
      const explorationPromises = batch.map(async (currentNode) => {
        if (currentNode.depth >= tree.maxDepth) {
          return
        }
        
        currentNode.status = 'exploring'
        
        if (onNodeUpdate) await onNodeUpdate(currentNode, tree)
        
        const children = await this.generateChildren(currentNode, tree, options)
        
        for (const child of children) {
          tree.nodes.set(child.id, child)
          tree.totalNodes++
          
          if (onNodeUpdate) await onNodeUpdate(child, tree)
        }
        
        const selectedChildren = this.selectChildren(children, strategy)
        
        for (const child of selectedChildren) {
          child.status = 'completed'
        }
        
        const prunedChildren = children.filter(c => !selectedChildren.includes(c))
        for (const child of prunedChildren) {
          child.status = 'pruned'
          tree.prunedNodes++
        }
        
        currentNode.status = 'completed'
        
        return selectedChildren
      })
      
      const results = await Promise.all(explorationPromises)
      
      for (const selectedChildren of results) {
        if (selectedChildren) {
          nodesToExplore.push(...selectedChildren)
        }
      }
      
      if (options.enableBacktracking) {
        const allNodes = Array.from(tree.nodes.values())
        for (const node of allNodes) {
          if (node.status === 'completed' && node.depth > 0) {
            const backtrackDecision = this.shouldBacktrack(tree, node, options)
            if (backtrackDecision) {
              await this.performBacktrack(tree, backtrackDecision, options)
              break
            }
          }
        }
      }
    }
  }

  // ============================================
  // 子节点生成
  // ============================================
  
  private async generateChildren(
    parent: ThoughtNode,
    tree: ThoughtTree,
    options: ToTOptions
  ): Promise<ThoughtNode[]> {
    const strategy = options.branchStrategy || this.defaultOptions.branchStrategy!
    const maxBranches = strategy.maxBranches || 5
    
    const prompt = this.buildGenerationPrompt(parent, tree, options)
    
    const response = await llmService.chat(
      options.model || 'openai',
      [
        { role: 'system', content: this.getSystemPrompt(options) },
        { role: 'user', content: prompt }
      ],
      {
        temperature: options.temperature,
        max_tokens: options.maxTokens
      }
    )
    
    if (!response.success || !response.content) {
      return []
    }
    
    const branches = this.parseBranches(response.content)
    const children: ThoughtNode[] = []
    
    for (const branch of branches.slice(0, maxBranches)) {
      const child = this.createChildNode(
        parent,
        branch.thought,
        branch.action,
        branch.actionInput,
        branch.confidence
      )
      
      child.metadata = {
        reasoning: branch.reasoning,
        alternatives: branch.alternatives,
        estimatedValue: branch.confidence
      }
      
      children.push(child)
    }
    
    return children
  }

  private buildGenerationPrompt(
    parent: ThoughtNode,
    tree: ThoughtTree,
    options: ToTOptions
  ): string {
    const strategy = options.branchStrategy || this.defaultOptions.branchStrategy!
    
    return `Current task: ${tree.task}

Current reasoning path (depth ${parent.depth}):
${this.getPathToNode(parent, tree)}

Generate ${strategy.maxBranches || 3} different approaches to continue the reasoning.

For each approach, provide:
1. Thought: Your reasoning
2. Action: Tool to use (optional)
3. Confidence: Your confidence (0-1)
4. Reasoning: Why this approach is promising

Format each approach as:
Approach 1:
Thought: <your thought>
Action: <tool name or "continue">
Confidence: <0-1>
Reasoning: <explanation>

Be diverse in your approaches. Consider different perspectives and strategies.`
  }

  private getSystemPrompt(options: ToTOptions): string {
    return `You are an expert at Tree-of-Thought reasoning. Your task is to generate diverse, high-quality reasoning branches.

Key principles:
- Generate diverse approaches, not variations of the same idea
- Consider different problem-solving strategies
- Estimate confidence honestly
- Provide clear reasoning for each approach
- Balance exploration and exploitation

Available tools: read_file, write_file, execute_command, list_dir, grep_search, web_fetch, respond_to_user`
  }

  private parseBranches(content: string): Array<{
    thought: string
    action?: string
    actionInput?: any
    confidence: number
    reasoning: string
    alternatives?: string[]
  }> {
    const branches: any[] = []
    const approachRegex = /Approach\s+\d+:\s*\n([\s\S]*?)(?=\nApproach\s+\d+:|$)/g
    
    let match
    while ((match = approachRegex.exec(content)) !== null) {
      const approachText = match[1]
      const thoughtMatch = approachText.match(/Thought:\s*(.+?)(?=\n|$)/i)
      const actionMatch = approachText.match(/Action:\s*(.+?)(?=\n|$)/i)
      const confidenceMatch = approachText.match(/Confidence:\s*([\d.]+)(?=\n|$)/i)
      const reasoningMatch = approachText.match(/Reasoning:\s*(.+?)(?=\n|$)/i)
      
      if (thoughtMatch && confidenceMatch) {
        branches.push({
          thought: thoughtMatch[1].trim(),
          action: actionMatch ? actionMatch[1].trim() : undefined,
          confidence: parseFloat(confidenceMatch[1]) || 0.5,
          reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided'
        })
      }
    }
    
    return branches
  }

  // ============================================
  // 子节点选择
  // ============================================
  
  private selectChildren(
    children: ThoughtNode[],
    strategy: BranchStrategy
  ): ThoughtNode[] {
    if (children.length === 0) return []
    
    switch (strategy.type) {
      case 'exhaustive':
        return children
      
      case 'beam':
        const beamWidth = strategy.beamWidth || 3
        return children
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, beamWidth)
      
      case 'best_first':
        const bestChild = children.reduce((best, child) => 
          child.confidence > best.confidence ? child : best
        )
        return [bestChild]
      
      case 'adaptive':
        return this.adaptiveSelection(children, strategy)
      
      default:
        return children.slice(0, strategy.maxBranches || 3)
    }
  }

  private adaptiveSelection(
    children: ThoughtNode[],
    strategy: BranchStrategy
  ): ThoughtNode[] {
    const threshold = strategy.confidenceThreshold || 0.3
    const diversityBonus = strategy.diversityBonus || 0.2
    const maxBranches = strategy.maxBranches || 5
    
    const scoredChildren = children.map(child => {
      let score = child.confidence
      
      if (child.metadata?.alternatives && child.metadata.alternatives.length > 0) {
        score += diversityBonus * 0.5
      }
      
      return { child, score }
    })
    
    scoredChildren.sort((a, b) => b.score - a.score)
    
    const selected = scoredChildren
      .filter(sc => sc.score >= threshold)
      .slice(0, maxBranches)
      .map(sc => sc.child)
    
    return selected.length > 0 ? selected : [scoredChildren[0].child]
  }

  // ============================================
  // 回溯机制
  // ============================================
  
  private shouldBacktrack(
    tree: ThoughtTree,
    node: ThoughtNode,
    options: ToTOptions
  ): BacktrackDecision | null {
    const threshold = options.pruningThreshold || 0.2
    
    if (node.confidence < threshold) {
      return {
        nodeId: node.id,
        reason: 'low_confidence',
        confidence: node.confidence,
        timestamp: Date.now()
      }
    }
    
    const siblings = this.getSiblings(node, tree)
    const betterSibling = siblings.find(s => s.confidence > node.confidence + 0.2)
    
    if (betterSibling) {
      return {
        nodeId: node.id,
        reason: 'better_path_found',
        alternativeNodeId: betterSibling.id,
        confidence: betterSibling.confidence,
        timestamp: Date.now()
      }
    }
    
    return null
  }

  private async performBacktrack(
    tree: ThoughtTree,
    decision: BacktrackDecision,
    options: ToTOptions
  ): Promise<void> {
    const node = tree.nodes.get(decision.nodeId)
    if (!node) return
    
    node.status = 'pruned'
    tree.prunedNodes++
    
    this.emit('backtrack', { decision, treeId: tree.id })
    
    if (decision.alternativeNodeId) {
      const alternativeNode = tree.nodes.get(decision.alternativeNodeId)
      if (alternativeNode) {
        alternativeNode.status = 'exploring'
      }
    }
  }

  private getSiblings(node: ThoughtNode, tree: ThoughtTree): ThoughtNode[] {
    if (!node.parentId) return []
    
    const parent = tree.nodes.get(node.parentId)
    if (!parent) return []
    
    return parent.children.filter(c => c.id !== node.id)
  }

  // ============================================
  // 最佳路径查找
  // ============================================
  
  private findBestPath(tree: ThoughtTree, options: ToTOptions): ThoughtNode[] {
    const leaves = Array.from(tree.nodes.values())
      .filter(node => node.children.length === 0)
    
    if (leaves.length === 0) {
      return [tree.root]
    }
    
    const diversityWeight = options.diversityWeight || 0.3
    const confidenceWeight = options.confidenceWeight || 0.4
    const efficiencyWeight = options.efficiencyWeight || 0.3
    
    let bestLeaf = leaves[0]
    let bestScore = 0
    
    for (const leaf of leaves) {
      const path = this.getPathToNode(leaf, tree)
      
      const avgConfidence = path.reduce((sum, n) => sum + n.confidence, 0) / path.length
      const efficiency = 1 / path.length
      const diversity = this.calculatePathDiversity(path)
      
      const score = (
        avgConfidence * confidenceWeight +
        efficiency * efficiencyWeight +
        diversity * diversityWeight
      )
      
      if (score > bestScore) {
        bestScore = score
        bestLeaf = leaf
      }
    }
    
    return this.getPathToNode(bestLeaf, tree)
  }

  private getPathToNode(node: ThoughtNode, tree: ThoughtTree): ThoughtNode[] {
    const path: ThoughtNode[] = []
    let currentNode: ThoughtNode | undefined = node
    
    while (currentNode) {
      path.unshift(currentNode)
      currentNode = currentNode.parentId ? tree.nodes.get(currentNode.parentId) : undefined
    }
    
    return path
  }

  private calculatePathDiversity(path: ThoughtNode[]): number {
    if (path.length <= 1) return 0
    
    const actions = path
      .filter(n => n.action)
      .map(n => n.action!)
    
    const uniqueActions = new Set(actions)
    return uniqueActions.size / actions.length
  }

  // ============================================
  // 工具方法
  // ============================================
  
  getTreeStatistics(tree: ThoughtTree): {
    totalNodes: number
    maxDepth: number
    avgDepth: number
    prunedNodes: number
    branchingFactor: number
  } {
    const nodes = Array.from(tree.nodes.values())
    const depths = nodes.map(n => n.depth)
    
    const branchingFactor = nodes.length > 1 
      ? nodes.filter(n => n.children.length > 0)
          .reduce((sum, n) => sum + n.children.length, 0) / 
        nodes.filter(n => n.children.length > 0).length
      : 0
    
    return {
      totalNodes: tree.totalNodes,
      maxDepth: tree.maxDepth,
      avgDepth: depths.reduce((a, b) => a + b, 0) / depths.length,
      prunedNodes: tree.prunedNodes,
      branchingFactor
    }
  }
}

export const thoughtTreeEngine = new ThoughtTreeEngine()
