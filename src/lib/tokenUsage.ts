import { createClient } from '@supabase/supabase-js';

interface TokenUsageData {
  userId: string;
  conversationId?: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

// Approximate token costs per 1M tokens for various HF models
const MODEL_COSTS: Record<string, { inputCost: number; outputCost: number }> = {
  'mistralai/Mistral-7B-Instruct-v0.2': { inputCost: 0.14, outputCost: 0.42 },
  'mistralai/Mixtral-8x7B-Instruct-v0.1': { inputCost: 0.27, outputCost: 0.81 },
  'meta-llama/Llama-2-7b-chat-hf': { inputCost: 0.08, outputCost: 0.24 },
  'openchat/openchat-3.5': { inputCost: 0.04, outputCost: 0.12 },
};

/**
 * Estimate tokens from text using simple heuristic (~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost in USD based on model and token counts
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing = MODEL_COSTS[model] || { inputCost: 0.15, outputCost: 0.45 };
  const inputCost = (inputTokens / 1000000) * pricing.inputCost;
  const outputCost = (outputTokens / 1000000) * pricing.outputCost;
  return inputCost + outputCost;
}

/**
 * Log token usage to Supabase
 */
export async function logTokenUsage(
  supabase: ReturnType<typeof createClient>,
  data: TokenUsageData
): Promise<void> {
  try {
    const totalTokens = data.inputTokens + data.outputTokens;
    const cost = calculateCost(data.inputTokens, data.outputTokens, data.model);

    const { error } = await (supabase as any).from('token_usage').insert({
      user_id: data.userId,
      conversation_id: data.conversationId || null,
      tokens_consumed: totalTokens,
      cost,
      model: data.model,
    });

    if (error) {
      console.error('Error logging token usage:', error);
    }
  } catch (err) {
    console.error('Token usage logging failed:', err);
    // Don't throw - logging shouldn't break the app
  }
}

/**
 * Get user's token usage statistics for a time period
 */
export async function getUserTokenStats(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  days: number = 30
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await (supabase as any)
    .from('token_usage')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching token stats:', error);
    return null;
  }

  const stats = {
    totalTokens: 0,
    totalCost: 0,
    messageCount: data?.length || 0,
    byModel: {} as Record<string, { count: number; tokens: number; cost: number }>,
  };

  data?.forEach((record) => {
    stats.totalTokens += record.tokens_consumed;
    stats.totalCost += record.cost;

    if (!stats.byModel[record.model]) {
      stats.byModel[record.model] = { count: 0, tokens: 0, cost: 0 };
    }
    stats.byModel[record.model].count += 1;
    stats.byModel[record.model].tokens += record.tokens_consumed;
    stats.byModel[record.model].cost += record.cost;
  });

  return stats;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens > 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens > 1000) {
    return `${(tokens / 1000).toFixed(2)}K`;
  }
  return tokens.toString();
}
