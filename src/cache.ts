const DEFAULT_CACHE_SIZE = 100

export class BoundedCache<K, V> {
  private max: number
  private map: Map<K, V>

  constructor(max: number = DEFAULT_CACHE_SIZE) {
    this.max = max
    this.map = new Map()
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, value!)
    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.max) {
      const first = this.map.keys().next().value
      if (first !== undefined) this.map.delete(first as unknown as K)
    }
    this.map.set(key, value)
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }
}
