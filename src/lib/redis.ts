import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    client.on('error', (err) => {
      console.error('Redis error:', err);
    });

    await client.connect();
  }
  return client;
}

export function hashQuery(query: string): string {
  return crypto
    .createHash('md5')
    .update(query.toLowerCase().trim())
    .digest('hex');
}

export async function cacheQuery(
  queryHash: string,
  response: string,
  ttlSeconds: number = 3600
): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.setEx(`query:${queryHash}`, ttlSeconds, response);
  } catch (error) {
    console.error('Failed to cache query:', error);
  }
}

export async function getCachedQuery(queryHash: string): Promise<string | null> {
  try {
    const redis = await getRedisClient();
    return await redis.get(`query:${queryHash}`);
  } catch (error) {
    console.error('Failed to get cached query:', error);
    return null;
  }
}

export async function invalidateQueryCache(): Promise<void> {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys('query:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    console.error('Failed to invalidate query cache:', error);
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.flushAll();
  } catch (error) {
    console.error('Failed to clear all cache:', error);
  }
}
