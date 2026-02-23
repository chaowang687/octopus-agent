import React from 'react'
import { ProgressDetail, PhaseType, PHASE_CONFIG } from '../../types/MultiAgentTypes'
import './ProgressTracker.css'

interface ProgressTrackerProps {
  currentPhase: PhaseType
  progress: number
  progressDetail?: ProgressDetail
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  currentPhase,
  progress,
  progressDetail
}) => {
  const phases: PhaseType[] = ['requirements', 'architecture', 'implementation', 'testing', 'review']
  
  const getPhaseIndex = (phase: PhaseType): number => {
    return phases.indexOf(phase)
  }
  
  const getCurrentPhaseIndex = (): number => {
    return getPhaseIndex(currentPhase)
  }
  
  const getPhaseStatus = (phase: PhaseType): 'completed' | 'current' | 'pending' => {
    const currentIndex = getCurrentPhaseIndex()
    const phaseIndex = getPhaseIndex(phase)
    
    if (phaseIndex < currentIndex) return 'completed'
    if (phaseIndex === currentIndex) return 'current'
    return 'pending'
  }
  
  const getPhaseProgress = (phase: PhaseType): number => {
    const status = getPhaseStatus(phase)
    if (status === 'completed') return 100
    if (status === 'current') return progress
    return 0
  }
  
  return (
    <div className="progress-tracker">
      <div className="progress-header">
        <h3 className="progress-title">项目进度</h3>
        <div className="progress-percentage">{Math.round(progress)}%</div>
      </div>
      
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="phases-container">
        {phases.map((phase, index) => {
          const config = PHASE_CONFIG[phase]
          const status = getPhaseStatus(phase)
          const phaseProgress = getPhaseProgress(phase)
          
          return (
            <div 
              key={phase}
              className={`phase-item phase-${status}`}
            >
              <div className="phase-icon-wrapper">
                <div className="phase-icon">{config.icon}</div>
                {status === 'completed' && (
                  <div className="phase-check">✓</div>
                )}
              </div>
              
              <div className="phase-info">
                <div className="phase-label">{config.label}</div>
                <div className="phase-description">{config.description}</div>
                
                <div className="phase-progress-bar">
                  <div 
                    className="phase-progress-fill"
                    style={{ 
                      width: `${phaseProgress}%`,
                      backgroundColor: config.color 
                    }}
                  />
                </div>
              </div>
              
              {status === 'current' && progressDetail && (
                <div className="phase-detail">
                  <div className="phase-message">{progressDetail.message}</div>
                  
                  {progressDetail.subTasks && progressDetail.subTasks.length > 0 && (
                    <div className="sub-tasks">
                      {progressDetail.subTasks.map((subTask, subIndex) => (
                        <div key={subIndex} className="sub-task">
                          <div className={`sub-task-status sub-task-${subTask.status}`}>
                            {subTask.status === 'completed' && '✓'}
                            {subTask.status === 'in_progress' && '⟳'}
                            {subTask.status === 'pending' && '○'}
                            {subTask.status === 'failed' && '✗'}
                            {subTask.status === 'skipped' && '⊘'}
                          </div>
                          <div className="sub-task-name">{subTask.name}</div>
                          <div className="sub-task-progress">{subTask.progress}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
