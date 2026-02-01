export interface BrandDef {
  id: string
  name: string
  icon: string
  description: string
  category: 'text' | 'image' | 'video' | 'mixed'
}

export const ADAPTER_BRANDS: Record<string, BrandDef> = {
  openai: {
    id: 'openai',
    name: 'ChatGPT',
    icon: '/icons/gpt.svg',
    description: 'Текстовые модели от OpenAI',
    category: 'text',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Claude',
    icon: '/icons/claude.svg',
    description: 'Текстовые модели от Anthropic',
    category: 'text',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    icon: '/icons/gemini.svg',
    description: 'Мультимодальные модели от Google',
    category: 'text',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '/icons/deepsek.svg',
    description: 'Текстовые модели DeepSeek',
    category: 'text',
  },
  xai: {
    id: 'xai',
    name: 'Grok',
    icon: '/icons/grok.svg',
    description: 'Текстовые модели от xAI',
    category: 'text',
  },
}

export const MODEL_PREFIX_BRANDS: Record<string, BrandDef> = {
  'nano-banana': {
    id: 'nano-banana',
    name: 'Nano Banana',
    icon: '/icons/nanobanano.svg',
    description: 'Генерация изображений',
    category: 'image',
  },
  'face-swap': {
    id: 'face-swap',
    name: 'Face Swap',
    icon: '/icons/faceswap.svg',
    description: 'Замена лиц на изображениях',
    category: 'image',
  },
  'midjourney': {
    id: 'midjourney',
    name: 'Midjourney',
    icon: '/icons/midjournet.svg',
    description: 'Генерация изображений',
    category: 'image',
  },
  'mj': {
    id: 'midjourney',
    name: 'Midjourney',
    icon: '/icons/midjournet.svg',
    description: 'Генерация изображений',
    category: 'image',
  },
  'seedance': {
    id: 'seedance',
    name: 'Seedance',
    icon: '/icons/seedance.svg',
    description: 'Генерация видео',
    category: 'video',
  },
  'minimax': {
    id: 'minimax',
    name: 'MiniMax',
    icon: '/icons/hailuo.svg',
    description: 'Генерация изображений и видео',
    category: 'mixed',
  },
  'hailuo': {
    id: 'hailuo',
    name: 'Hailuo',
    icon: '/icons/hailuo.svg',
    description: 'Генерация видео от MiniMax',
    category: 'video',
  },
  'runway': {
    id: 'runway',
    name: 'Runway',
    icon: '/icons/runway.svg',
    description: 'Генерация видео и изображений',
    category: 'mixed',
  },
  'imagen': {
    id: 'imagen',
    name: 'Imagen',
    icon: '/icons/imagen.svg',
    description: 'Генерация изображений от Google',
    category: 'image',
  },
  'kling': {
    id: 'kling',
    name: 'Kling',
    icon: '/icons/kling.svg',
    description: 'Генерация видео',
    category: 'video',
  },
  'sora': {
    id: 'sora',
    name: 'Sora',
    icon: '/icons/sora.svg',
    description: 'Генерация видео от OpenAI',
    category: 'video',
  },
  'flux': {
    id: 'flux',
    name: 'Flux',
    icon: '/icons/flux.svg',
    description: 'Генерация изображений',
    category: 'image',
  },
  'luma': {
    id: 'luma',
    name: 'Luma',
    icon: '/icons/luma.svg',
    description: 'Генерация видео и изображений',
    category: 'mixed',
  },
  'veo': {
    id: 'veo',
    name: 'Veo',
    icon: '/icons/veo.svg',
    description: 'Генерация видео от Google',
    category: 'video',
  },
  'sd': {
    id: 'stable-diffusion',
    name: 'Stable Diffusion',
    icon: '/icons/stable.svg',
    description: 'Генерация изображений',
    category: 'image',
  },
}

const _sortedPrefixes = Object.keys(MODEL_PREFIX_BRANDS).sort((a, b) => b.length - a.length)

export function detectBrand(adapterName: string, modelId: string): BrandDef {
  if (ADAPTER_BRANDS[adapterName]) {
    return ADAPTER_BRANDS[adapterName]
  }

  for (const prefix of _sortedPrefixes) {
    if (modelId.startsWith(prefix)) {
      return MODEL_PREFIX_BRANDS[prefix]
    }
  }

  return {
    id: adapterName,
    name: adapterName,
    icon: '',
    description: '',
    category: 'mixed',
  }
}

export function isVariant(modelId: string): boolean {
  return modelId.includes(':')
}