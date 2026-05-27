const DEFAULT_CACHE_SIZE = 100

interface CacheEntry<V> {
  value: V
  expiry: number
}

function estimateBytes(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'string') return new TextEncoder().encode(value).length
  if (typeof value === 'function') return new TextEncoder().encode(value.toString()).length
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length
  } catch {
    return 64
  }
}

export interface CacheStats {
  size: number
  capacity: number
  hits: number
  misses: number
  evictions: number
  memoryBytes: number
  memoryMB: string
}

export class BoundedCache<K, V> {
  private max: number
  private defaultTtl: number
  private map: Map<K, CacheEntry<V>>
  private hits: number
  private misses: number
  private evictions: number
  private totalBytes: number
  private keyBytes: Map<K, number>

  constructor(max: number = DEFAULT_CACHE_SIZE, defaultTtl: number = 0) {
    this.max = Math.max(1, max)
    this.defaultTtl = defaultTtl
    this.map = new Map()
    this.hits = 0
    this.misses = 0
    this.evictions = 0
    this.totalBytes = 0
    this.keyBytes = new Map()
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) {
      this.misses++
      return undefined
    }
    const entry = this.map.get(key)!
    if (entry.expiry > 0 && Date.now() > entry.expiry) {
      this.map.delete(key)
      this.misses++
      return undefined
    }
    this.map.delete(key)
    this.map.set(key, entry)
    this.hits++
    return entry.value
  }

  set(key: K, value: V, ttl?: number): void {
    const expiryMs = ttl ?? this.defaultTtl
    const expiry = expiryMs > 0 ? Date.now() + expiryMs : 0

    if (this.map.has(key)) {
      this.totalBytes -= this.keyBytes.get(key) ?? 0
      this.map.delete(key)
    }

    const entryBytes = estimateBytes(value)
    this.keyBytes.set(key, entryBytes)
    this.totalBytes += entryBytes

    while (this.map.size >= this.max && this.map.size > 0) {
      const first = this.map.keys().next().value
      if (first !== undefined) {
        this.totalBytes -= this.keyBytes.get(first as unknown as K) ?? 0
        this.keyBytes.delete(first as unknown as K)
        this.map.delete(first as unknown as K)
        this.evictions++
      }
    }

    this.map.set(key, { value, expiry })
  }

  delete(key: K): boolean {
    const existed = this.map.delete(key)
    if (existed) {
      this.totalBytes -= this.keyBytes.get(key) ?? 0
      this.keyBytes.delete(key)
    }
    return existed
  }

  clear(): void {
    this.map.clear()
    this.keyBytes.clear()
    this.totalBytes = 0
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  purge(): number {
    const now = Date.now()
    let purged = 0
    for (const [key, entry] of this.map) {
      if (entry.expiry > 0 && now > entry.expiry) {
        this.totalBytes -= this.keyBytes.get(key) ?? 0
        this.keyBytes.delete(key)
        this.map.delete(key)
        purged++
      }
    }
    return purged
  }

  get size(): number {
    return this.map.size
  }

  get stats(): CacheStats {
    const memoryBytes = this.totalBytes
    return {
      size: this.map.size,
      capacity: this.max,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      memoryBytes,
      memoryMB: (memoryBytes / (1024 * 1024)).toFixed(3),
    }
  }
}
