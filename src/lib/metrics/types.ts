/**
 * Metric system types for the pluggable evaluation framework
 */

import type { ParsedMessage, SessionMetadata } from '@/types/message'
import type { JudgeConfig } from '@/lib/judge/types'

/**
 * A metric definition registered in the system.
 * Each metric is an independent module with its own compute logic.
 */
export interface MetricDefinition {
  /** Unique identifier, e.g. 'tool_usage', 'response_quality' */
  id: string
  /** English name */
  name: string
  /** Chinese name */
  nameZh: string
  /** Short description of what this metric measures */
  description: string
  /** 'objective' = computed from data (no LLM), 'subjective' = LLM-judged */
  type: 'objective' | 'subjective'
  /** Tags for filtering in the UI, e.g. ['agent', 'tool', 'cost', 'quality'] */
  tags: string[]
  /** Credits cost per execution. 0 = free (objective metrics). */
  creditsCost: number
  /** Compute the metric result */
  compute(context: MetricContext): Promise<MetricResult>
}

/**
 * Context passed to each metric's compute function.
 * Contains everything a metric needs to evaluate a session.
 */
export interface MetricContext {
  /** The session being evaluated */
  sessionId: string
  /** All parsed messages from the session */
  messages: ParsedMessage[]
  /** Session metadata (message counts, tool calls, tokens, etc.) */
  metadata: SessionMetadata
  /** Judge config — only provided for subjective metrics */
  judgeConfig?: JudgeConfig
}

/**
 * Result returned by each metric's compute function.
 * The `detail` field has a per-metric custom structure.
 */
export interface MetricResult {
  /** Score 0-100. Use null for metrics that don't produce a score (pure statistics). */
  score: number | null
  /** One-line summary of the result */
  summary: string
  /** Per-metric custom detail structure. Each metric defines its own shape. */
  detail: Record<string, unknown>
  /** Tells the frontend which renderer component to use */
  renderHint: string
}