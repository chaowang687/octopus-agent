export interface DomainKnowledge {
  domain: 'product' | 'ui' | 'development' | 'testing' | 'architecture'
  concepts: Concept[]
  bestPractices: BestPractice[]
  commonPatterns: Pattern[]
  antiPatterns: Pattern[]
  tools: Tool[]
  metrics: Metric[]
}

export interface Concept {
  id: string
  name: string
  definition: string
  examples: string[]
  relatedConcepts: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface BestPractice {
  id: string
  name: string
  description: string
  whenToUse: string[]
  whenNotToUse: string[]
  benefits: string[]
  tradeoffs: string[]
  examples: string[]
}

export interface Pattern {
  id: string
  name: string
  category: string
  description: string
  implementation: string
  useCases: string[]
  alternatives: string[]
}

export interface Tool {
  id: string
  name: string
  category: string
  purpose: string
  usage: string
  alternatives: string[]
  learningResources: string[]
}

export interface Metric {
  id: string
  name: string
  category: string
  description: string
  howToMeasure: string
  benchmarks: Benchmark[]
}

export interface Benchmark {
  context: string
  good: number
  excellent: number
  unit: string
}

export interface ProjectPhase {
  phase: 'requirements' | 'design' | 'development' | 'testing' | 'deployment' | 'maintenance'
  objectives: string[]
  deliverables: string[]
  activities: Activity[]
  qualityGates: QualityGate[]
  risks: Risk[]
}

export interface Activity {
  id: string
  name: string
  description: string
  dependencies: string[]
  estimatedDuration: string
  requiredSkills: string[]
  tools: string[]
}

export interface QualityGate {
  id: string
  name: string
  criteria: string[]
  passThreshold: number
  automated: boolean
}

export interface Risk {
  id: string
  name: string
  description: string
  probability: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  mitigation: string[]
}

export interface ProblemDiagnosis {
  problemId: string
  symptoms: string[]
  possibleCauses: PossibleCause[]
  diagnosticSteps: DiagnosticStep[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  urgency: 'low' | 'medium' | 'high'
}

export interface PossibleCause {
  cause: string
  likelihood: number
  evidence: string[]
}

export interface DiagnosticStep {
  step: number
  action: string
  expectedResult: string
  tool?: string
}

export interface Solution {
  solutionId: string
  problemId: string
  approach: 'quick_fix' | 'proper_fix' | 'refactor' | 'redesign'
  description: string
  steps: SolutionStep[]
  estimatedEffort: string
  risks: string[]
  alternatives: string[]
}

export interface SolutionStep {
  step: number
  action: string
  code?: string
  command?: string
  verification?: string
}

export interface Workflow {
  workflowId: string
  name: string
  description: string
  trigger: string
  steps: WorkflowStep[]
  conditions: Condition[]
  expectedOutcome: string
}

export interface WorkflowStep {
  step: number
  action: string
  agent?: string
  tool?: string
  parameters?: any
  onSuccess?: string
  onFailure?: string
}

export interface Condition {
  condition: string
  evaluate: () => boolean
}

export interface LearningExperience {
  experienceId: string
  projectId: string
  problem: string
  solution: string
  outcome: 'success' | 'failure' | 'partial'
  lessonsLearned: string[]
  applicableContexts: string[]
  confidence: number
  timestamp: number
}

export interface ExpertiseLevel {
  domain: string
  level: 'novice' | 'apprentice' | 'practitioner' | 'expert' | 'master'
  experiences: number
  successRate: number
  lastUpdated: number
}
