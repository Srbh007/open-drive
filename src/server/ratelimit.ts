import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/server/redis'

// Simple rate limiter: 10 requests per 10 seconds.
export const rateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
})
