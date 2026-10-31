import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/server/redis'

// Separate budgets per kind of public traffic. Image links are embedded in product pages,
// so they get a much larger budget than link pages and uploads.
export const linkPageLimit = new Ratelimit({
  redis,
  prefix: 'rl:link-page',
  limiter: Ratelimit.slidingWindow(60, '1 m'),
})

export const imageLimit = new Ratelimit({
  redis,
  prefix: 'rl:image',
  limiter: Ratelimit.slidingWindow(300, '1 m'),
})

export const uploadLimit = new Ratelimit({
  redis,
  prefix: 'rl:upload',
  limiter: Ratelimit.slidingWindow(30, '1 m'),
})

export const unlockLimit = new Ratelimit({
  redis,
  prefix: 'rl:unlock',
  limiter: Ratelimit.slidingWindow(10, '10 m'),
})
