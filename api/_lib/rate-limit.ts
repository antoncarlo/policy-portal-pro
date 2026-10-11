/**
 * Rate limit shared by every instance of the functions: the counter lives in the database
 * (`rate_limit_hit`, one atomic increment per call), so a burst spread over several instances or over
 * a cold start is counted once. If the database cannot be reached the call is counted in the memory
 * of the instance instead: a weaker limit, but the endpoint does not fall over with the database.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window ends; 0 when the call is allowed. */
  retryAfter: number;
}

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

/** The part of the Supabase client the limiter uses. */
export interface RpcClient {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

interface LocalWindow {
  count: number;
  windowStart: number;
}

const local = new Map<string, LocalWindow>();

function hitLocal(bucket: string, { limit, windowSeconds }: RateLimitOptions, now = Date.now()): RateLimitResult {
  const windowMs = windowSeconds * 1000;
  const entry = local.get(bucket);
  if (!entry || now - entry.windowStart >= windowMs) {
    local.set(bucket, { count: 1, windowStart: now });
    if (local.size > 5000) for (const [key, value] of local) if (now - value.windowStart >= windowMs) local.delete(key);
    return { allowed: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) return { allowed: false, retryAfter: Math.max(Math.ceil((entry.windowStart + windowMs - now) / 1000), 1) };
  return { allowed: true, retryAfter: 0 };
}

export async function hitRateLimit(client: RpcClient, bucket: string, options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const { data, error } = await client.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as { allowed?: unknown; retry_after?: unknown } | null | undefined;
    if (!row || typeof row.allowed !== 'boolean') throw new Error('unexpected answer');
    return { allowed: row.allowed, retryAfter: row.allowed ? 0 : Math.max(Number(row.retry_after) || 1, 1) };
  } catch (error) {
    console.error('rate_limit_hit: counter of this instance used instead:', error instanceof Error ? error.message : error);
    return hitLocal(bucket, options);
  }
}

/** Test hook: forget the counters of this instance. */
export function resetLocalRateLimits(): void {
  local.clear();
}
