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
  supportsImageInput?: boolean
  requiresImage?: boolean
  supportsNegativePrompt?: boolean
  supportsOutputFormat?: boolean
  requiresTwoImages?: boolean
}

const MODEL_METADATA: Record<string, ModelMeta> = {
    'flux-2/pro-text-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'], supportsImageInput: true },
  'flux-2/pro-image-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'], requiresImage: true },
  'flux-2/flex-text-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'], supportsImageInput: true },
  'flux-2/flex-image-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'], requiresImage: true },
  'nano-banana-pro': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'], resolutions: ['1K', '2K', '4K'] },
  'nano-banana-pro-i2i': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'], resolutions: ['1K', '2K'] },
  'google/nano-banana': { aspectRatios: ['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3'] },
  'google/nano-banana-edit': { aspectRatios: ['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3'], requiresImage: true },
  'midjourney/text-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] },
  'midjourney/image-to-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], requiresImage: true },
  'midjourney/image-to-video': { aspectRatios: ['16:9', '9:16'], requiresImage: true },
  'mj_txt2img': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] },
  'mj_img2img': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], requiresImage: true },
  'mj_video': { aspectRatios: ['16:9', '9:16'], requiresImage: true },
  'black-forest-labs/flux-pro': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], supportsImageInput: true },
  'black-forest-labs/flux-dev': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], supportsImageInput: true },
  'black-forest-labs/flux-schnell': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] },
  'google/imagen-4': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] },
  'google/imagen-4-fast': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] },
  'google/imagen-4-ultra': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] },
  'stability-ai/stable-diffusion-3.5-large': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], supportsImageInput: true, supportsNegativePrompt: true, supportsOutputFormat: true },
  'stability-ai/stable-diffusion-3.5-large-turbo': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], supportsImageInput: true, supportsNegativePrompt: true, supportsOutputFormat: true },
  'minimax/image-01': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'], supportsImageInput: true },
  'luma/photon-flash': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['1K', '2K'], supportsImageInput: true },
  'runwayml/gen4-image': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['720p', '1080p'], supportsImageInput: true },
  'runwayml/gen4-image-turbo': { aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], resolutions: ['720p', '1080p'], requiresImage: true },
  'cdingram/face-swap': { requiresImage: true, requiresTwoImages: true },
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
    variants: bm.variants?.map(v => ({ key: v.key, label: v.label, credits_price: v.credits_price })) || undefined,
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