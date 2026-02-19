import React, { useState } from 'react'

export interface DecisionOption {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  recommendation?: number
}

interface DecisionDialogProps {
  isOpen: boolean
  decisionId: string
  stepTitle: string
  title: string
  description: string
  options: DecisionOption[]
  onSelect: (optionId: string, reason?: string) => void
  onCancel: () => void
  onSkip?: () => void
}

export const DecisionDialog: React.FC<DecisionDialogProps> = ({
  isOpen,
  stepTitle,
  title,
  description,
  options,
  onSelect,
  onCancel,
  onSkip
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  const handleSelect = () => {
    if (selectedOption) {
      onSelect(selectedOption, reason || undefined)
    }
  }

  const getRecommendationStars = (recommendation?: number): string => {
    if (!recommendation) return ''
    return '⭐'.repeat(recommendation)
  }

  const getRecommendationReason = (recommendation?: number): string => {
    if (!recommendation) return ''
    const reasons = [
      '',
      '基础方案，适合简单场景',
      '推荐方案，平衡性能和复杂度',
      '强烈推荐，最佳实践',
      '完美方案，强烈建议使用',
      '最优方案，无需考虑其他选项'
    ]
    return reasons[recommendation] || ''
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🎯</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">需要您的决策</h2>
              <p className="text-sm text-gray-500">步骤: {stepTitle}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{description}</p>
          </div>

          <div className="space-y-4 mb-6">
            {options.map((option, index) => (
              <div
                key={option.id}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedOption === option.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedOption(option.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedOption === option.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedOption === option.id && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        选项{String.fromCharCode(65 + index)}: {option.title}
                      </h4>
                      {option.recommendation && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-yellow-500">{getRecommendationStars(option.recommendation)}</span>
                          <span className="text-sm text-gray-600">
                            智能体推荐: {getRecommendationReason(option.recommendation)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 mb-3 ml-9">{option.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-9">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <h5 className="text-sm font-semibold text-green-800 mb-2">优点</h5>
                    <ul className="text-sm text-green-700 space-y-1">
                      {option.pros.length > 0 ? (
                        option.pros.map((pro, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>{pro}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500">无</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-red-50 p-3 rounded-lg">
                    <h5 className="text-sm font-semibold text-red-800 mb-2">缺点</h5>
                    <ul className="text-sm text-red-700 space-y-1">
                      {option.cons.length > 0 ? (
                        option.cons.map((con, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">✗</span>
                            <span>{con}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500">无</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择理由（可选）
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明您选择该选项的理由..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                稍后决定
              </button>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="px-6 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
                >
                  跳过此步骤
                </button>
              )}
            </div>

            <button
              onClick={handleSelect}
              disabled={!selectedOption}
              className={`px-6 py-2 rounded-lg transition-colors ${
                selectedOption
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              确认选择
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
