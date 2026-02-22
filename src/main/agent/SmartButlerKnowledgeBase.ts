import { DomainKnowledge, ProjectPhase, ProblemDiagnosis, Solution, Workflow, LearningExperience } from './SmartButlerKnowledge'

export const ProductKnowledge: DomainKnowledge = {
  domain: 'product',
  concepts: [
    {
      id: 'prod-001',
      name: 'MVP (Minimum Viable Product)',
      definition: '最小可行产品，包含最核心功能的产品版本，用于快速验证市场需求',
      examples: ['MVP只包含核心功能', 'MVP用于市场验证', 'MVP快速迭代'],
      relatedConcepts: ['prod-002', 'prod-003'],
      difficulty: 'beginner'
    },
    {
      id: 'prod-002',
      name: '用户故事',
      definition: '从用户角度描述功能需求的简短描述',
      examples: ['作为用户，我想要登录', '作为管理员，我想要查看报表'],
      relatedConcepts: ['prod-003'],
      difficulty: 'beginner'
    },
    {
      id: 'prod-003',
      name: '产品路线图',
      definition: '展示产品功能和时间规划的战略文档',
      examples: ['季度路线图', '年度路线图', '功能优先级'],
      relatedConcepts: ['prod-001'],
      difficulty: 'intermediate'
    }
  ],
  bestPractices: [
    {
      id: 'prod-bp-001',
      name: '以用户为中心的设计',
      description: '始终从用户需求出发设计产品',
      whenToUse: ['产品规划', '功能设计', '用户体验优化'],
      whenNotToUse: ['技术架构决策', '后端API设计'],
      benefits: ['提高用户满意度', '减少返工', '提升产品成功率'],
      tradeoffs: ['需要更多用户研究时间', '可能增加初期开发成本'],
      examples: ['用户访谈', '用户测试', 'A/B测试']
    },
    {
      id: 'prod-bp-002',
      name: '敏捷开发',
      description: '采用迭代和增量的方式开发产品',
      whenToUse: ['需求不明确', '市场变化快', '需要快速验证'],
      whenNotToUse: ['需求完全明确', '安全要求极高', '监管严格'],
      benefits: ['快速响应变化', '持续交付价值', '降低风险'],
      tradeoffs: ['需要频繁沟通', '文档可能不完整'],
      examples: ['Scrum', 'Kanban', 'XP']
    }
  ],
  commonPatterns: [
    {
      id: 'prod-pat-001',
      name: '功能分层',
      category: '产品规划',
      description: '将功能分为必须有、应该有、可以有、不会有',
      implementation: '使用MoSCoW方法优先级排序',
      useCases: ['需求分析', '版本规划', '资源分配'],
      alternatives: ['Kano模型', '价值vs复杂度矩阵']
    }
  ],
  antiPatterns: [
    {
      id: 'prod-ap-001',
      name: '功能蔓延',
      category: '产品管理',
      description: '不断增加新功能，导致产品变得复杂难以使用',
      implementation: '避免无限制添加功能',
      useCases: [],
      alternatives: ['功能优先级管理', '定期功能审查']
    }
  ],
  tools: [
    {
      id: 'prod-tool-001',
      name: 'Figma',
      category: '原型设计',
      purpose: '创建交互式原型和设计稿',
      usage: '用于UI设计和用户测试',
      alternatives: ['Sketch', 'Adobe XD', 'Framer'],
      learningResources: ['Figma官方教程', 'YouTube Figma教程']
    },
    {
      id: 'prod-tool-002',
      name: 'Jira',
      category: '项目管理',
      purpose: '跟踪任务和缺陷',
      usage: '敏捷开发和项目管理',
      alternatives: ['Trello', 'Asana', 'Notion'],
      learningResources: ['Jira官方文档', 'Atlassian大学']
    }
  ],
  metrics: [
    {
      id: 'prod-met-001',
      name: '用户留存率',
      category: '产品指标',
      description: '用户在特定时间后继续使用产品的比例',
      howToMeasure: '跟踪用户登录和使用频率',
      benchmarks: [
        { context: 'SaaS产品', good: 0.4, excellent: 0.6, unit: '30天' },
        { context: '移动应用', good: 0.3, excellent: 0.5, unit: '7天' }
      ]
    },
    {
      id: 'prod-met-002',
      name: '净推荐值 (NPS)',
      category: '产品指标',
      description: '用户推荐产品的意愿',
      howToMeasure: '用户调查：0-10分，9-10为推荐者，0-6为贬损者',
      benchmarks: [
        { context: '优秀产品', good: 40, excellent: 70, unit: '分数' }
      ]
    }
  ]
}

export const UIKnowledge: DomainKnowledge = {
  domain: 'ui',
  concepts: [
    {
      id: 'ui-001',
      name: '响应式设计',
      definition: '设计能够适应不同屏幕尺寸和设备的界面',
      examples: ['移动端适配', '平板适配', '桌面端适配'],
      relatedConcepts: ['ui-002', 'ui-003'],
      difficulty: 'intermediate'
    },
    {
      id: 'ui-002',
      name: '可访问性 (Accessibility)',
      definition: '确保所有用户，包括残障用户，都能使用产品',
      examples: ['键盘导航', '屏幕阅读器支持', '颜色对比度'],
      relatedConcepts: ['ui-001'],
      difficulty: 'intermediate'
    },
    {
      id: 'ui-003',
      name: '设计系统',
      definition: '一套可重用的设计组件和指南',
      examples: ['Material Design', 'Ant Design', 'Tailwind CSS'],
      relatedConcepts: ['ui-001'],
      difficulty: 'advanced'
    }
  ],
  bestPractices: [
    {
      id: 'ui-bp-001',
      name: '一致性原则',
      description: '在整个产品中保持视觉和交互的一致性',
      whenToUse: ['所有UI设计', '组件开发', '交互设计'],
      whenNotToUse: [],
      benefits: ['提高用户熟悉度', '减少学习成本', '提升品牌认知'],
      tradeoffs: ['需要严格的设计规范', '可能限制创意'],
      examples: ['统一的颜色方案', '一致的按钮样式', '标准的交互模式']
    },
    {
      id: 'ui-bp-002',
      name: '移动优先',
      description: '先设计移动端，再扩展到桌面端',
      whenToUse: ['移动应用', '响应式网站', '移动优先产品'],
      whenNotToUse: ['桌面专用应用', '企业内部系统'],
      benefits: ['聚焦核心功能', '更好的移动体验', '渐进增强'],
      tradeoffs: ['可能限制桌面端功能'],
      examples: ['移动端导航', '触摸优化', '简化界面']
    }
  ],
  commonPatterns: [
    {
      id: 'ui-pat-001',
      name: '卡片布局',
      category: '布局模式',
      description: '使用卡片容器组织内容',
      implementation: 'Grid或Flexbox布局，带阴影和圆角',
      useCases: ['内容展示', '产品列表', '仪表板'],
      alternatives: ['列表布局', '瀑布流']
    },
    {
      id: 'ui-pat-002',
      name: '汉堡菜单',
      category: '导航模式',
      description: '折叠的导航菜单，通常用三条线图标表示',
      implementation: '侧边栏或下拉菜单',
      useCases: ['移动端导航', '节省空间'],
      alternatives: ['底部导航', '标签栏', '顶部导航']
    }
  ],
  antiPatterns: [
    {
      id: 'ui-ap-001',
      name: '过度设计',
      category: 'UI设计',
      description: '添加不必要的动画、效果或装饰',
      implementation: '避免过度装饰',
      useCases: [],
      alternatives: ['简洁设计', '功能优先']
    }
  ],
  tools: [
    {
      id: 'ui-tool-001',
      name: 'React',
      category: '前端框架',
      purpose: '构建用户界面',
      usage: '组件化开发，状态管理',
      alternatives: ['Vue', 'Angular', 'Svelte'],
      learningResources: ['React官方文档', 'React教程']
    },
    {
      id: 'ui-tool-002',
      name: 'Tailwind CSS',
      category: 'CSS框架',
      purpose: '快速构建UI',
      usage: '实用类CSS框架',
      alternatives: ['Bootstrap', 'Material-UI', 'Chakra UI'],
      learningResources: ['Tailwind官方文档', 'Tailwind教程']
    }
  ],
  metrics: [
    {
      id: 'ui-met-001',
      name: '页面加载时间',
      category: '性能指标',
      description: '页面完全加载所需时间',
      howToMeasure: 'Lighthouse或WebPageTest',
      benchmarks: [
        { context: '移动端', good: 3, excellent: 1.5, unit: '秒' },
        { context: '桌面端', good: 2, excellent: 1, unit: '秒' }
      ]
    },
    {
      id: 'ui-met-002',
      name: '首次内容绘制 (FCP)',
      category: '性能指标',
      description: '首次绘制内容的时间',
      howToMeasure: 'Lighthouse',
      benchmarks: [
        { context: '优秀', good: 1.8, excellent: 1, unit: '秒' }
      ]
    }
  ]
}

export const DevelopmentKnowledge: DomainKnowledge = {
  domain: 'development',
  concepts: [
    {
      id: 'dev-001',
      name: '代码复用',
      definition: '编写可重用的代码组件和函数',
      examples: ['组件库', '工具函数', 'Hook'],
      relatedConcepts: ['dev-002', 'dev-003'],
      difficulty: 'intermediate'
    },
    {
      id: 'dev-002',
      name: '设计模式',
      definition: '解决常见软件设计问题的可重用方案',
      examples: ['单例模式', '工厂模式', '观察者模式'],
      relatedConcepts: ['dev-001'],
      difficulty: 'advanced'
    },
    {
      id: 'dev-003',
      name: '代码审查',
      definition: '同行评审代码以提高质量',
      examples: ['Pull Request审查', '代码走查', '结对编程'],
      relatedConcepts: ['dev-001'],
      difficulty: 'beginner'
    }
  ],
  bestPractices: [
    {
      id: 'dev-bp-001',
      name: 'DRY原则 (Don\'t Repeat Yourself)',
      description: '避免代码重复，提高可维护性',
      whenToUse: ['所有编码', '重构', '架构设计'],
      whenNotToUse: ['过度抽象导致复杂性'],
      benefits: ['减少代码量', '提高可维护性', '降低错误率'],
      tradeoffs: ['可能增加抽象层'],
      examples: ['提取公共函数', '创建组件', '使用继承']
    },
    {
      id: 'dev-bp-002',
      name: '测试驱动开发 (TDD)',
      description: '先写测试，再写代码',
      whenToUse: ['新功能开发', '重构', '关键业务逻辑'],
      whenNotToUse: ['快速原型', '探索性开发'],
      benefits: ['提高代码质量', '设计更好的API', '文档作用'],
      tradeoffs: ['初期开发速度慢', '需要测试技能'],
      examples: ['单元测试', '集成测试', '端到端测试']
    }
  ],
  commonPatterns: [
    {
      id: 'dev-pat-001',
      name: 'MVC架构',
      category: '架构模式',
      description: '模型-视图-控制器分离',
      implementation: '分离数据、界面和逻辑',
      useCases: ['Web应用', '桌面应用'],
      alternatives: ['MVVM', 'MVP', 'Clean Architecture']
    },
    {
      id: 'dev-pat-002',
      name: '状态管理',
      category: '数据流',
      description: '集中管理应用状态',
      implementation: 'Redux, Vuex, Zustand等',
      useCases: ['复杂应用', '跨组件状态共享'],
      alternatives: ['Context API', 'Props Drilling']
    }
  ],
  antiPatterns: [
    {
      id: 'dev-ap-001',
      name: '面条代码',
      category: '代码质量',
      description: '混乱、难以理解的代码',
      implementation: '避免复杂的嵌套和全局变量',
      useCases: [],
      alternatives: ['模块化', '函数式编程', '面向对象']
    }
  ],
  tools: [
    {
      id: 'dev-tool-001',
      name: 'TypeScript',
      category: '编程语言',
      purpose: '类型安全的JavaScript',
      usage: '大型项目，团队协作',
      alternatives: ['JavaScript', 'Flow'],
      learningResources: ['TypeScript官方文档', 'TypeScript教程']
    },
    {
      id: 'dev-tool-002',
      name: 'ESLint',
      category: '代码质量',
      purpose: '代码检查和格式化',
      usage: '保持代码风格一致',
      alternatives: ['Prettier', 'JSHint'],
      learningResources: ['ESLint官方文档']
    }
  ],
  metrics: [
    {
      id: 'dev-met-001',
      name: '代码覆盖率',
      category: '测试指标',
      description: '测试覆盖的代码比例',
      howToMeasure: 'Istanbul, Jest coverage',
      benchmarks: [
        { context: '良好', good: 0.7, excellent: 0.9, unit: '百分比' }
      ]
    },
    {
      id: 'dev-met-002',
      name: '代码复杂度',
      category: '代码质量',
      description: '代码的复杂程度',
      howToMeasure: '圈复杂度分析工具',
      benchmarks: [
        { context: '函数', good: 10, excellent: 5, unit: '圈复杂度' }
      ]
    }
  ]
}

export const TestingKnowledge: DomainKnowledge = {
  domain: 'testing',
  concepts: [
    {
      id: 'test-001',
      name: '单元测试',
      definition: '测试单个函数或组件',
      examples: ['测试函数返回值', '测试组件渲染', '测试边界情况'],
      relatedConcepts: ['test-002', 'test-003'],
      difficulty: 'beginner'
    },
    {
      id: 'test-002',
      name: '集成测试',
      definition: '测试多个组件或模块的集成',
      examples: ['测试API调用', '测试数据库操作', '测试用户流程'],
      relatedConcepts: ['test-001', 'test-003'],
      difficulty: 'intermediate'
    },
    {
      id: 'test-003',
      name: '端到端测试 (E2E)',
      definition: '测试完整的用户流程',
      examples: ['测试登录流程', '测试购买流程', '测试注册流程'],
      relatedConcepts: ['test-001', 'test-002'],
      difficulty: 'advanced'
    }
  ],
  bestPractices: [
    {
      id: 'test-bp-001',
      name: '测试金字塔',
      description: '大量单元测试，适量集成测试，少量E2E测试',
      whenToUse: ['所有测试策略', '测试计划'],
      whenNotToUse: [],
      benefits: ['快速反馈', '低成本', '高覆盖率'],
      tradeoffs: ['需要平衡测试类型'],
      examples: ['70%单元测试', '20%集成测试', '10%E2E测试']
    },
    {
      id: 'test-bp-002',
      name: 'AAA模式',
      description: 'Arrange-Act-Assert测试结构',
      whenToUse: ['所有测试编写'],
      whenNotToUse: [],
      benefits: ['清晰的测试结构', '易于理解', '易于维护'],
      tradeoffs: [],
      examples: ['准备数据', '执行操作', '验证结果']
    }
  ],
  commonPatterns: [
    {
      id: 'test-pat-001',
      name: '模拟 (Mocking)',
      category: '测试技术',
      description: '模拟外部依赖',
      implementation: '使用Mock函数或对象',
      useCases: ['API调用', '数据库操作', '第三方服务'],
      alternatives: ['Stub', 'Spy']
    }
  ],
  antiPatterns: [
    {
      id: 'test-ap-001',
      name: '脆弱测试',
      category: '测试质量',
      description: '容易失败的测试',
      implementation: '避免依赖实现细节',
      useCases: [],
      alternatives: ['测试行为而非实现', '使用测试工具']
    }
  ],
  tools: [
    {
      id: 'test-tool-001',
      name: 'Jest',
      category: '测试框架',
      purpose: 'JavaScript/TypeScript测试',
      usage: '单元测试，集成测试',
      alternatives: ['Mocha', 'Vitest', 'Jasmine'],
      learningResources: ['Jest官方文档', 'Jest教程']
    },
    {
      id: 'test-tool-002',
      name: 'Cypress',
      category: 'E2E测试',
      purpose: '端到端测试',
      usage: '用户流程测试',
      alternatives: ['Playwright', 'Selenium', 'Puppeteer'],
      learningResources: ['Cypress官方文档', 'Cypress教程']
    }
  ],
  metrics: [
    {
      id: 'test-met-001',
      name: '测试通过率',
      category: '测试指标',
      description: '测试通过的比例',
      howToMeasure: 'CI/CD测试报告',
      benchmarks: [
        { context: '优秀', good: 0.95, excellent: 1.0, unit: '百分比' }
      ]
    },
    {
      id: 'test-met-002',
      name: '测试执行时间',
      category: '测试指标',
      description: '测试套件执行时间',
      howToMeasure: '测试框架报告',
      benchmarks: [
        { context: '快速', good: 300, excellent: 60, unit: '秒' }
      ]
    }
  ]
}

export const ArchitectureKnowledge: DomainKnowledge = {
  domain: 'architecture',
  concepts: [
    {
      id: 'arch-001',
      name: '微服务架构',
      definition: '将应用拆分为小型、独立的服务',
      examples: ['用户服务', '订单服务', '支付服务'],
      relatedConcepts: ['arch-002', 'arch-003'],
      difficulty: 'advanced'
    },
    {
      id: 'arch-002',
      name: '单体架构',
      definition: '所有功能在一个应用中',
      examples: ['小型应用', 'MVP', '内部工具'],
      relatedConcepts: ['arch-001'],
      difficulty: 'beginner'
    },
    {
      id: 'arch-003',
      name: '事件驱动架构',
      definition: '通过事件通信的架构',
      examples: ['消息队列', '事件总线', '发布订阅'],
      relatedConcepts: ['arch-001'],
      difficulty: 'advanced'
    }
  ],
  bestPractices: [
    {
      id: 'arch-bp-001',
      name: '高内聚低耦合',
      description: '模块内部紧密相关，模块之间松散耦合',
      whenToUse: ['所有架构设计', '模块划分'],
      whenNotToUse: [],
      benefits: ['易于维护', '易于测试', '易于扩展'],
      tradeoffs: ['需要良好的设计'],
      examples: ['模块化设计', '依赖注入', '接口隔离']
    },
    {
      id: 'arch-bp-002',
      name: '可扩展性设计',
      description: '系统能够处理增长',
      whenToUse: ['所有架构设计', '容量规划'],
      whenNotToUse: [],
      benefits: ['应对增长', '降低成本', '提高性能'],
      tradeoffs: ['初期可能过度设计'],
      examples: ['水平扩展', '垂直扩展', '缓存策略']
    }
  ],
  commonPatterns: [
    {
      id: 'arch-pat-001',
      name: '分层架构',
      category: '架构模式',
      description: '将应用分为不同层次',
      implementation: '表现层、业务层、数据层',
      useCases: ['Web应用', '企业应用'],
      alternatives: ['六边形架构', '洋葱架构']
    },
    {
      id: 'arch-pat-002',
      name: 'API网关',
      category: '架构模式',
      description: '统一入口点',
      implementation: 'Nginx, Kong, AWS API Gateway',
      useCases: ['微服务', 'API管理'],
      alternatives: ['负载均衡器', '服务网格']
    }
  ],
  antiPatterns: [
    {
      id: 'arch-ap-001',
      name: '分布式单体',
      category: '架构反模式',
      description: '名义上是微服务，实际紧密耦合',
      implementation: '避免服务间过度依赖',
      useCases: [],
      alternatives: ['真正的微服务', '单体应用']
    }
  ],
  tools: [
    {
      id: 'arch-tool-001',
      name: 'Docker',
      category: '容器化',
      purpose: '应用打包和部署',
      usage: '容器化应用，环境一致性',
      alternatives: ['Podman', 'LXC'],
      learningResources: ['Docker官方文档', 'Docker教程']
    },
    {
      id: 'arch-tool-002',
      name: 'Kubernetes',
      category: '容器编排',
      purpose: '管理容器化应用',
      usage: '大规模容器管理',
      alternatives: ['Docker Swarm', 'Nomad'],
      learningResources: ['Kubernetes官方文档', 'Kubernetes教程']
    }
  ],
  metrics: [
    {
      id: 'arch-met-001',
      name: '系统可用性',
      category: '可靠性指标',
      description: '系统正常运行时间',
      howToMeasure: '监控和告警系统',
      benchmarks: [
        { context: '优秀', good: 0.99, excellent: 0.999, unit: '百分比' }
      ]
    },
    {
      id: 'arch-met-002',
      name: '响应时间',
      category: '性能指标',
      description: '系统响应请求的时间',
      howToMeasure: 'APM工具',
      benchmarks: [
        { context: '优秀', good: 200, excellent: 100, unit: '毫秒' }
      ]
    }
  ]
}

export const ProjectPhases: ProjectPhase[] = [
  {
    phase: 'requirements',
    objectives: [
      '明确产品需求',
      '识别用户需求',
      '定义功能范围',
      '制定项目计划'
    ],
    deliverables: [
      '需求文档',
      '用户故事',
      '原型设计',
      '项目计划'
    ],
    activities: [
      {
        id: 'req-act-001',
        name: '需求收集',
        description: '收集和分析用户需求',
        dependencies: [],
        estimatedDuration: '1-2周',
        requiredSkills: ['产品管理', '用户研究'],
        tools: ['Figma', 'Miro', 'Notion']
      },
      {
        id: 'req-act-002',
        name: '原型设计',
        description: '创建产品原型',
        dependencies: ['req-act-001'],
        estimatedDuration: '1-2周',
        requiredSkills: ['UI/UX设计', '原型工具'],
        tools: ['Figma', 'Sketch', 'Adobe XD']
      }
    ],
    qualityGates: [
      {
        id: 'req-qg-001',
        name: '需求评审通过',
        criteria: ['需求明确', '用户故事完整', '原型可用'],
        passThreshold: 0.9,
        automated: false
      }
    ],
    risks: [
      {
        id: 'req-risk-001',
        name: '需求不明确',
        description: '需求理解偏差或需求变更',
        probability: 'high',
        impact: 'high',
        mitigation: ['用户访谈', '原型验证', '敏捷迭代']
      }
    ]
  },
  {
    phase: 'design',
    objectives: [
      '设计系统架构',
      '设计数据库',
      '设计API',
      '设计UI/UX'
    ],
    deliverables: [
      '架构设计文档',
      '数据库设计',
      'API文档',
      'UI设计稿'
    ],
    activities: [
      {
        id: 'des-act-001',
        name: '架构设计',
        description: '设计系统架构',
        dependencies: [],
        estimatedDuration: '1-2周',
        requiredSkills: ['系统架构', '技术选型'],
        tools: ['Draw.io', 'Lucidchart', 'Mermaid']
      },
      {
        id: 'des-act-002',
        name: 'UI设计',
        description: '设计用户界面',
        dependencies: ['req-act-002'],
        estimatedDuration: '2-4周',
        requiredSkills: ['UI设计', '设计系统'],
        tools: ['Figma', 'Sketch', 'Adobe XD']
      }
    ],
    qualityGates: [
      {
        id: 'des-qg-001',
        name: '设计评审通过',
        criteria: ['架构合理', 'UI符合规范', 'API设计完整'],
        passThreshold: 0.9,
        automated: false
      }
    ],
    risks: [
      {
        id: 'des-risk-001',
        name: '设计不切实际',
        description: '设计无法实现或成本过高',
        probability: 'medium',
        impact: 'high',
        mitigation: ['技术可行性分析', '成本评估', '迭代设计']
      }
    ]
  },
  {
    phase: 'development',
    objectives: [
      '实现功能',
      '编写测试',
      '代码审查',
      '持续集成'
    ],
    deliverables: [
      '功能代码',
      '测试代码',
      '测试报告',
      'CI/CD配置'
    ],
    activities: [
      {
        id: 'dev-act-001',
        name: '功能开发',
        description: '实现产品功能',
        dependencies: ['des-act-001', 'des-act-002'],
        estimatedDuration: '4-12周',
        requiredSkills: ['前端开发', '后端开发', '全栈开发'],
        tools: ['VS Code', 'Git', 'CI/CD']
      },
      {
        id: 'dev-act-002',
        name: '测试开发',
        description: '编写和执行测试',
        dependencies: ['dev-act-001'],
        estimatedDuration: '2-4周',
        requiredSkills: ['测试开发', '自动化测试'],
        tools: ['Jest', 'Cypress', 'Playwright']
      }
    ],
    qualityGates: [
      {
        id: 'dev-qg-001',
        name: '代码审查通过',
        criteria: ['代码质量', '测试覆盖率', '文档完整'],
        passThreshold: 0.8,
        automated: true
      },
      {
        id: 'dev-qg-002',
        name: '测试通过',
        criteria: ['所有测试通过', '覆盖率达标'],
        passThreshold: 1.0,
        automated: true
      }
    ],
    risks: [
      {
        id: 'dev-risk-001',
        name: '技术债务',
        description: '快速开发导致代码质量下降',
        probability: 'high',
        impact: 'medium',
        mitigation: ['代码审查', '重构', '技术债务跟踪']
      }
    ]
  },
  {
    phase: 'testing',
    objectives: [
      '功能测试',
      '性能测试',
      '安全测试',
      '用户验收'
    ],
    deliverables: [
      '测试报告',
      '缺陷报告',
      '性能报告',
      '验收报告'
    ],
    activities: [
      {
        id: 'test-act-001',
        name: '功能测试',
        description: '测试所有功能',
        dependencies: ['dev-act-001', 'dev-act-002'],
        estimatedDuration: '2-4周',
        requiredSkills: ['功能测试', '自动化测试'],
        tools: ['Jest', 'Cypress', 'TestRail']
      },
      {
        id: 'test-act-002',
        name: '性能测试',
        description: '测试系统性能',
        dependencies: ['test-act-001'],
        estimatedDuration: '1-2周',
        requiredSkills: ['性能测试', '压力测试'],
        tools: ['JMeter', 'Lighthouse', 'WebPageTest']
      }
    ],
    qualityGates: [
      {
        id: 'test-qg-001',
        name: '所有缺陷修复',
        criteria: ['严重缺陷为0', '一般缺陷<10'],
        passThreshold: 1.0,
        automated: false
      },
      {
        id: 'test-qg-002',
        name: '性能达标',
        criteria: ['响应时间<2s', '吞吐量达标'],
        passThreshold: 0.9,
        automated: true
      }
    ],
    risks: [
      {
        id: 'test-risk-001',
        name: '测试不充分',
        description: '遗漏关键测试场景',
        probability: 'medium',
        impact: 'high',
        mitigation: ['测试计划', '探索性测试', '用户测试']
      }
    ]
  },
  {
    phase: 'deployment',
    objectives: [
      '部署到生产环境',
      '监控系统',
      '配置告警',
      '准备回滚'
    ],
    deliverables: [
      '部署文档',
      '监控配置',
      '告警配置',
      '运维手册'
    ],
    activities: [
      {
        id: 'dep-act-001',
        name: '生产部署',
        description: '部署到生产环境',
        dependencies: ['test-act-001', 'test-act-002'],
        estimatedDuration: '1-3天',
        requiredSkills: ['DevOps', '运维'],
        tools: ['Docker', 'Kubernetes', 'CI/CD']
      },
      {
        id: 'dep-act-002',
        name: '监控配置',
        description: '配置监控和告警',
        dependencies: ['dep-act-001'],
        estimatedDuration: '1-2天',
        requiredSkills: ['监控', '告警'],
        tools: ['Prometheus', 'Grafana', 'ELK']
      }
    ],
    qualityGates: [
      {
        id: 'dep-qg-001',
        name: '部署成功',
        criteria: ['服务正常运行', '监控正常'],
        passThreshold: 1.0,
        automated: true
      }
    ],
    risks: [
      {
        id: 'dep-risk-001',
        name: '部署失败',
        description: '部署过程中出现问题',
        probability: 'medium',
        impact: 'high',
        mitigation: ['灰度发布', '回滚方案', '监控告警']
      }
    ]
  },
  {
    phase: 'maintenance',
    objectives: [
      '监控系统',
      '修复缺陷',
      '优化性能',
      '收集反馈'
    ],
    deliverables: [
      '监控报告',
      '缺陷报告',
      '优化报告',
      '用户反馈报告'
    ],
    activities: [
      {
        id: 'maint-act-001',
        name: '系统监控',
        description: '持续监控系统状态',
        dependencies: [],
        estimatedDuration: '持续',
        requiredSkills: ['监控', '运维'],
        tools: ['Prometheus', 'Grafana', 'ELK']
      },
      {
        id: 'maint-act-002',
        name: '缺陷修复',
        description: '修复生产环境缺陷',
        dependencies: ['maint-act-001'],
        estimatedDuration: '持续',
        requiredSkills: ['开发', '测试'],
        tools: ['Jira', 'Git', 'CI/CD']
      }
    ],
    qualityGates: [
      {
        id: 'maint-qg-001',
        name: '系统稳定',
        criteria: ['可用性>99%', '响应时间<2s'],
        passThreshold: 0.99,
        automated: true
      }
    ],
    risks: [
      {
        id: 'maint-risk-001',
        name: '系统故障',
        description: '系统出现故障或性能问题',
        probability: 'medium',
        impact: 'high',
        mitigation: ['监控告警', '备份恢复', '应急预案']
      }
    ]
  }
]
