import { useState, useEffect, useMemo } from 'react'
import { detectBrand, isVariant, type BrandDef } from '../data/brands'
import type { Model, ModelCategory, TaskType } from '../data/models'

const API_BASE = import.meta.env.VITE_API_URL || ''

export interface APIVariant {
  key: string
  label: string
  credits_price: number | null
}

export interface APIModel {
  id: string
  display_name: string
  type: string
  pricing: { input_per_1k: number; output_per_1k: number }
  credits_price: number | null
  is_enabled: boolean
  variants: APIVariant[] | null
  min_credits_price: number | null
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
  variants: APIVariant[] | null
  minCreditsPrice: number | null
}

export interface Brand extends BrandDef {
  models: BrandModel[]
  modelCount: number
}

interface ModelMeta {
  aspectRatios?: string[]
  resolutions?: string[]
}

const MODEL_METADATA: Record<string, ModelMeta> = {
  'flux-2/pro-text-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'] },
  'flux-2/pro-image-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'] },
  'flux-2/flex-text-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'] },
  'flux-2/flex-image-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'] },
  'nano-banana-pro': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'], resolutions: ['1K', '2K', '4K'] },
  'nano-banana-pro-i2i': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'], resolutions: ['1K', '2K'] },
  'midjourney/text-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] },
  'midjourney/image-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] },
  'midjourney/image-to-video': { aspectRatios: ['16:9', '9:16'] },
}

let cachedBrands: Brand[] | null = null

function groupByBrand(providers: APIProvider[]): Brand[] {
  const brandMap = new Map<string, Brand>()
  const seen = new Set<string>()

  for (const provider of providers) {
    for (const model of provider.models) {
      if (isVariant(model.id)) continue

      const def = detectBrand(provider.name, model.id)
      if (!def) continue

      const dedupeKey = `${def.id}:${model.id}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

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
        variants: model.variants || null,
        minCreditsPrice: model.min_credits_price ?? null,
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

export function brandModelToModel(brand: Brand, bm: BrandModel): Model {
  const cat: ModelCategory = bm.type === 'image' ? 'image' : bm.type === 'video' ? 'video' : 'text'
  const task: TaskType = cat === 'text' ? 'text' : cat === 'image' ? 't2i' : 't2v'
  const meta = MODEL_METADATA[bm.id]

  return {
    id: bm.id,
    provider: bm.adapter,
    name: `${brand.name} — ${bm.displayName || bm.id}`,
    shortName: '',
    description: brand.description,
    category: cat,
    taskType: task,
    cost: bm.minCreditsPrice ?? bm.creditsPrice ?? 0,
    rating: 0,
    users: 0,
    icon: brand.icon,
    color: '#6366f1',
    backendModel: bm.id,
    ...(meta || {}),
  }
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

  const allModels = useMemo(() => {
    const models: Model[] = []
    for (const brand of brands) {
      for (const bm of brand.models) {
        models.push(brandModelToModel(brand, bm))
      }
    }
    return models
  }, [brands])

  return { brands, allModels, loading, error }
}