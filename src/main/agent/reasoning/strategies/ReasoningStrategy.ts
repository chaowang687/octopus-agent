/**
 * Reasoning Strategy Interface
 * 推理策略接口
 */

import { ReasoningContext, ReasoningResult, ReasoningType } from '../ReasoningFramework'

export interface ReasoningStrategy {
  readonly type: ReasoningType
  execute(context: ReasoningContext): Promise<ReasoningResult>
}