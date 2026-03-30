/**
 * Token bucket rate limiter for balldontlie API (5 req/min free tier).
 * Queues requests and processes them respecting the rate limit.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefill: number;
  private queue: Array<{
    resolve: (value: void) => void;
    reject: (error: Error) => void;
  }> = [];
  private draining = false;

  constructor(maxRequests: number, windowMs: number) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.refillRate = maxRequests / windowMs;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Queue the request
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.drain();
    });
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;

    while (this.queue.length > 0) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        const next = this.queue.shift();
        next?.resolve();
      } else {
        // Wait until we have a token
        const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    this.draining = false;
  }
}
