import { useState, useEffect } from 'react'
import { detectBrand, isVariant, type BrandDef } from '../data/brands'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export interface APIModel {
  id: string
  display_name: string
  type: string
  pricing: {
    input_per_1k: number
    output_per_1k: number
  }
  credits_price: number | null
  is_enabled: boolean
}

export interface APIProvider {
  name: string
  display_name: string
  type: string
  models: APIModel[]
}

export interface BrandModel {
  id: string
  displayName: string
  type: string
  adapter: string
  creditsPrice: number | null
}

export interface Brand extends BrandDef {
  models: BrandModel[]
  modelCount: number
}

let cachedBrands: Brand[] | null = null

function groupByBrand(providers: APIProvider[]): Brand[] {
  const brandMap = new Map<string, Brand>()
  const seen = new Set<string>()

  for (const provider of providers) {
    for (const model of provider.models) {
      if (isVariant(model.id)) continue

      const def = detectBrand(provider.name, model.id)
      const key = `${def.id}:${model.id}`

      if (seen.has(key)) continue
      seen.add(key)

      if (!brandMap.has(def.id)) {
        brandMap.set(def.id, { ...def, models: [], modelCount: 0 })
      }

      const brand = brandMap.get(def.id)!
      brand.models.push({
        id: model.id,
        displayName: model.display_name,
        type: model.type,
        adapter: provider.name,
        creditsPrice: model.credits_price,
      })
      brand.modelCount = brand.models.length
    }
  }

  const order: Record<string, number> = { text: 0, image: 1, video: 2, mixed: 3 }
  return Array.from(brandMap.values()).sort((a, b) => {
    const d = (order[a.category] ?? 9) - (order[b.category] ?? 9)
    return d !== 0 ? d : b.modelCount - a.modelCount
  })
}

export function useProviders() {
  const [brands, setBrands] = useState<Brand[]>(cachedBrands || [])
  const [loading, setLoading] = useState(!cachedBrands)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedBrands) return

    const ctrl = new AbortController()

    fetch(`${API_BASE}/api/v1/providers?enabled_only=true`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          const grouped = groupByBrand(data.providers)
          cachedBrands = grouped
          setBrands(grouped)
        } else {
          setError('Ошибка загрузки провайдеров')
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => setLoading(false))

    return () => ctrl.abort()
  }, [])

  return { brands, loading, error }
}