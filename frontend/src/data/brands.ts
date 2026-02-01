export interface BrandDef {
  id: string
  name: string
  icon: string
  description: string
  category: 'text' | 'image' | 'video' | 'mixed'
}

const BRANDS: Record<string, BrandDef> = {
  chatgpt: { id: 'chatgpt', name: 'ChatGPT', icon: '/icons/gpt.svg', description: 'Текстовые модели от OpenAI', category: 'text' },
  claude: { id: 'claude', name: 'Claude', icon: '/icons/claude.svg', description: 'Текстовые модели от Anthropic', category: 'text' },
  gemini: { id: 'gemini', name: 'Gemini', icon: '/icons/gemini.svg', description: 'Мультимодальные модели от Google', category: 'text' },
  deepseek: { id: 'deepseek', name: 'DeepSeek', icon: '/icons/deepsek.svg', description: 'Текстовые модели DeepSeek', category: 'text' },
  grok: { id: 'grok', name: 'Grok', icon: '/icons/grok.svg', description: 'Текстовые модели от xAI', category: 'text' },
  'nano-banana': { id: 'nano-banana', name: 'Nano Banana', icon: '/icons/nanobanano.svg', description: 'Генерация изображений', category: 'image' },
  midjourney: { id: 'midjourney', name: 'Midjourney', icon: '/icons/midjournet.svg', description: 'Генерация изображений', category: 'image' },
  flux: { id: 'flux', name: 'Flux', icon: '/icons/flux.svg', description: 'Генерация изображений', category: 'image' },
  'stable-diffusion': { id: 'stable-diffusion', name: 'Stable Diffusion', icon: '/icons/stable.svg', description: 'Генерация изображений', category: 'image' },
  imagen: { id: 'imagen', name: 'Imagen', icon: '/icons/imagen.svg', description: 'Генерация изображений от Google', category: 'image' },
  'face-swap': { id: 'face-swap', name: 'Face Swap', icon: '/icons/faceswap.svg', description: 'Замена лиц на изображениях', category: 'image' },
  kling: { id: 'kling', name: 'Kling', icon: '/icons/kling.svg', description: 'Генерация видео', category: 'video' },
  sora: { id: 'sora', name: 'Sora', icon: '/icons/sora.svg', description: 'Генерация видео от OpenAI', category: 'video' },
  hailuo: { id: 'hailuo', name: 'Hailuo', icon: '/icons/hailuo.svg', description: 'Генерация видео от MiniMax', category: 'video' },
  veo: { id: 'veo', name: 'Veo', icon: '/icons/veo.svg', description: 'Генерация видео от Google', category: 'video' },
  seedance: { id: 'seedance', name: 'Seedance', icon: '/icons/seedance.svg', description: 'Генерация видео', category: 'video' },
  runway: { id: 'runway', name: 'Runway', icon: '/icons/runway.svg', description: 'Генерация видео и изображений', category: 'mixed' },
  luma: { id: 'luma', name: 'Luma', icon: '/icons/luma.svg', description: 'Генерация видео и изображений', category: 'mixed' },
}

const ADAPTER_TO_BRAND: Record<string, string> = {
  openai: 'chatgpt',
  anthropic: 'claude',
  gemini: 'gemini',
  deepseek: 'deepseek',
  xai: 'grok',
  nano_banana: 'nano-banana',
  kling: 'kling',
  midjourney: 'midjourney',
  veo: 'veo',
  sora: 'sora',
  hailuo: 'hailuo',
  runway: 'runway',
  seedance: 'seedance',
  flux: 'flux',
}

const OWNER_TO_BRAND: Record<string, string> = {
  'runwayml': 'runway',
  'luma': 'luma',
  'black-forest-labs': 'flux',
  'stability-ai': 'stable-diffusion',
  'kwaivgi': 'kling',
  'cdingram': 'face-swap',
  'bytedance': 'seedance',
  'minimax': 'hailuo',
  'openai': 'sora',
  'google': 'imagen',
}

const NAME_PATTERNS: [string, string][] = [
  ['nano-banana', 'nano-banana'],
  ['hailuo', 'hailuo'],
  ['veo', 'veo'],
  ['imagen', 'imagen'],
  ['sora', 'sora'],
  ['flux', 'flux'],
  ['seedance', 'seedance'],
  ['kling', 'kling'],
  ['midjourney', 'midjourney'],
  ['mj_', 'midjourney'],
  ['mj-', 'midjourney'],
  ['stable-diffusion', 'stable-diffusion'],
  ['face-swap', 'face-swap'],
  ['gen4', 'runway'],
  ['gen-4', 'runway'],
  ['ray', 'luma'],
  ['photon', 'luma'],
]

export function detectBrand(adapterName: string, modelId: string): BrandDef | null {
  const direct = ADAPTER_TO_BRAND[adapterName]
  if (direct) return BRANDS[direct] || null

  const slashIdx = modelId.indexOf('/')
  if (slashIdx > 0) {
    const owner = modelId.substring(0, slashIdx)
    const name = modelId.substring(slashIdx + 1)

    const ownerBrand = OWNER_TO_BRAND[owner]
    if (ownerBrand) return BRANDS[ownerBrand] || null

    for (const [pattern, brandId] of NAME_PATTERNS) {
      if (name.startsWith(pattern)) return BRANDS[brandId] || null
    }
  }

  for (const [pattern, brandId] of NAME_PATTERNS) {
    if (modelId.startsWith(pattern)) return BRANDS[brandId] || null
  }

  return null
}

export function isVariant(modelId: string): boolean {
  return modelId.includes(':')
}