import { createClient } from '@supabase/supabase-js';

interface RateLimitConfig {
  maxMessagesPerWindow: number; // Max messages allowed in time window
  windowSeconds: number; // Time window in seconds (default: 3600 = 1 hour)
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxMessagesPerWindow: 100, // 100 messages per hour
  windowSeconds: 3600,
};

/**
 * Initialize rate limit for user if not exists
 */
export async function initializeRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<void> {
  const { error } = await (supabase as any).from('rate_limits').upsert(
    {
      user_id: userId,
      message_count: 0,
      last_reset: new Date().toISOString(),
      window_seconds: config.windowSeconds,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('Error initializing rate limit:', error);
  }
}

/**
 * Check if user is within rate limit
 */
export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}> {
  try {
    // Get or initialize rate limit
    let { data, error } = await (supabase as any)
      .from('rate_limits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching rate limit:', error);
    }

    if (!data) {
      await initializeRateLimit(supabase, userId, config);
      return {
        allowed: true,
        remaining: config.maxMessagesPerWindow - 1,
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      };
    }

    const lastReset = new Date(data.last_reset).getTime();
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const elapsedMs = now - lastReset;

    // Check if window has passed
    if (elapsedMs > windowMs) {
      // Reset counter
      const { error: updateError } = await (supabase as any)
        .from('rate_limits')
        .update({
          message_count: 1,
          last_reset: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error resetting rate limit:', updateError);
      }

      return {
        allowed: true,
        remaining: config.maxMessagesPerWindow - 1,
        resetAt: new Date(now + windowMs),
      };
    }

    // Within window - check if limit exceeded
    const remaining = config.maxMessagesPerWindow - data.message_count;

    if (remaining <= 0) {
      const resetAt = new Date(lastReset + windowMs);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: `Rate limit exceeded. Reset at ${resetAt.toLocaleTimeString()}`,
      };
    }

    // Allowed - increment counter
    const { error: incrementError } = await (supabase as any)
      .from('rate_limits')
      .update({ message_count: data.message_count + 1 })
      .eq('user_id', userId);

    if (incrementError) {
      console.error('Error incrementing rate limit counter:', incrementError);
    }

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt: new Date(lastReset + windowMs),
    };
  } catch (err) {
    console.error('Rate limit check failed:', err);
    // Allow on error to not break the app
    return {
      allowed: true,
      remaining: DEFAULT_CONFIG.maxMessagesPerWindow,
      resetAt: new Date(Date.now() + DEFAULT_CONFIG.windowSeconds * 1000),
    };
  }
}

/**
 * Get formatted rate limit status for display
 */
export function formatRateLimitStatus(status: Awaited<ReturnType<typeof checkRateLimit>>): string {
  if (status.allowed) {
    return `${status.remaining} messages remaining`;
  }
  const now = new Date();
  const minUntilReset = Math.ceil((status.resetAt.getTime() - now.getTime()) / 60000);
  return `Rate limited. Resets in ${minUntilReset} minute${minUntilReset !== 1 ? 's' : ''}`;
}
