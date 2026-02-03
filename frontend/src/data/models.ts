export type ModelCategory = 'text' | 'image' | 'video'
export type TaskType = 'text' | 't2i' | 'i2i' | 't2v' | 'i2v' | 'avatar' | 'motion'

export interface Model {
  id: string
  provider: string
  name: string
  shortName: string
  description: string
  category: ModelCategory
  taskType: TaskType
  cost: number
  variants?: { key: string; label: string; credits_price: number | null }[]
  rating: number
  users: number
  icon: string
  color: string
  backendModel: string
  requiresImage?: boolean
  supportsImageInput?: boolean
  supportsNegativePrompt?: boolean
  supportsOutputFormat?: boolean
  requiresTwoImages?: boolean
  requiresVideo?: boolean
  aspectRatios?: string[]
  resolutions?: string[]
  durations?: string[]
}

export const MODELS: Model[] = [
  {
    id: 'gpt-5.2',
    provider: 'openai',
    name: 'GPT 5.2',
    shortName: '5.2',
    description: 'Новейшая модель от OpenAI для текста и изображений',
    category: 'text',
    taskType: 'text',
    cost: 30,
    rating: 4.98,
    users: 165000,
    icon: '/icons/gpt.svg',
    color: '#10a37f',
    backendModel: 'gpt-4o'
  },
  {
    id: 'claude-sonnet-4.5',
    provider: 'anthropic',
    name: 'Claude Sonnet 4.5',
    shortName: 'Sonnet 4.5',
    description: 'Продвинутая модель от Anthropic для сложных задач',
    category: 'text',
    taskType: 'text',
    cost: 25,
    rating: 4.95,
    users: 89000,
    icon: '/icons/claude.svg',
    color: '#d97706',
    backendModel: 'claude-sonnet-4-5-20250929'
  },
  {
    id: 'gemini-3-pro',
    provider: 'gemini',
    name: 'Gemini 3 Pro',
    shortName: '3 Pro',
    description: 'Мощная мультимодальная модель от Google',
    category: 'text',
    taskType: 'text',
    cost: 20,
    rating: 4.90,
    users: 156000,
    icon: '/icons/gemini.svg',
    color: '#4285f4',
    backendModel: 'gemini-2.0-flash'
  },
  {
    id: 'gemini-3-flash',
    provider: 'gemini',
    name: 'Gemini 3 Flash',
    shortName: '3 Flash',
    description: 'Быстрая модель от Google для простых задач',
    category: 'text',
    taskType: 'text',
    cost: 5,
    rating: 4.85,
    users: 203000,
    icon: '/icons/gemini.svg',
    color: '#4285f4',
    backendModel: 'gemini-1.5-flash'
  },
  {
    id: 'deepseek-3.2-chat',
    provider: 'deepseek',
    name: 'DeepSeek 3.2 Chat',
    shortName: '3.2 Chat',
    description: 'Бесплатная модель для быстрых ответов',
    category: 'text',
    taskType: 'text',
    cost: 0,
    rating: 4.70,
    users: 234000,
    icon: '/icons/deepsek.svg',
    color: '#6366f1',
    backendModel: 'deepseek-chat'
  },
  {
    id: 'grok',
    provider: 'xai',
    name: 'Grok',
    shortName: '',
    description: 'Модель от xAI с доступом к актуальной информации',
    category: 'text',
    taskType: 'text',
    cost: 15,
    rating: 4.80,
    users: 120000,
    icon: '/icons/grok.svg',
    color: '#1d1d1f',
    backendModel: 'grok-3-mini'
  },
  {
    id: 'nanobanana-pro',
    provider: 'nano_banana',
    name: 'Nano Banana Pro',
    shortName: 'Nano Banana Pro',
    description: 'Лучшая нейросеть для генерации изображений',
    category: 'image',
    taskType: 't2i',
    cost: 55,
    rating: 4.90,
    users: 93000,
    icon: '/icons/nanobanano.svg',
    color: '#eab308',
    backendModel: 'nano-banana-pro',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    resolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'nanobanana-standard',
    provider: 'nano_banana',
    name: 'Nano Banana Standard',
    shortName: 'Nano Banana Standard',
    description: 'Базовая версия генератора изображений',
    category: 'image',
    taskType: 't2i',
    cost: 25,
    rating: 4.75,
    users: 145000,
    icon: '/icons/nanobanano.svg',
    color: '#eab308',
    backendModel: 'google/nano-banana',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    resolutions: ['1K', '2K'],
  },
  {
    id: 'midjourney-t2i',
    provider: 'midjourney',
    name: 'Midjourney Text to Image',
    shortName: 'Text to Image',
    description: 'Генерация изображений по текстовому описанию',
    category: 'image',
    taskType: 't2i',
    cost: 30,
    rating: 4.95,
    users: 320000,
    icon: '/icons/midjournet.svg',
    color: '#0d9488',
    backendModel: 'mj_txt2img',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
  },
  {
    id: 'midjourney-i2i',
    provider: 'midjourney',
    name: 'Midjourney Image to Image',
    shortName: 'Image to Image',
    description: 'Преобразование и стилизация изображений',
    category: 'image',
    taskType: 'i2i',
    cost: 35,
    rating: 4.88,
    users: 180000,
    icon: '/icons/midjournet.svg',
    color: '#0d9488',
    backendModel: 'mj_img2img',
    requiresImage: true,
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
  },
  {
    id: 'flux',
    provider: 'flux',
    name: 'Flux',
    shortName: 'Flux 2 Pro',
    description: 'Генерация изображений высокого качества',
    category: 'image',
    taskType: 't2i',
    cost: 25,
    rating: 4.82,
    users: 110000,
    icon: '/icons/flux.svg',
    color: '#8b5cf6',
    backendModel: 'flux-2/pro-text-to-image',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
    resolutions: ['1K', '2K'],
  },
  {
    id: 'midjourney-i2v',
    provider: 'midjourney',
    name: 'Midjourney Image to Video',
    shortName: 'Image to Video',
    description: 'Создание видео из статичных изображений',
    category: 'video',
    taskType: 'i2v',
    cost: 100,
    rating: 4.80,
    users: 67000,
    icon: '/icons/midjournet.svg',
    color: '#0d9488',
    backendModel: 'mj_video',
    requiresImage: true,
  },
  {
    id: 'kling-avatar-pro',
    provider: 'kling',
    name: 'Kling Avatar Pro',
    shortName: 'Kling Avatar Pro',
    description: 'Создание реалистичных аватаров с анимацией',
    category: 'video',
    taskType: 'avatar',
    cost: 150,
    rating: 4.85,
    users: 45000,
    icon: '/icons/faceswap.svg',
    color: '#22c55e',
    backendModel: 'kling/ai-avatar-pro',
    requiresImage: true,
  },
  {
    id: 'kling-2.6-i2v',
    provider: 'kling',
    name: 'Kling 2.6 Image to Video',
    shortName: 'Image to Video',
    description: 'Генерация видео из изображений нового поколения',
    category: 'video',
    taskType: 'i2v',
    cost: 200,
    rating: 4.92,
    users: 89000,
    icon: '/icons/kling.svg',
    color: '#22c55e',
    backendModel: 'kling-2.6/image-to-video',
    requiresImage: true,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    durations: ['5', '10'],
  },
  {
    id: 'kling-t2v',
    provider: 'kling',
    name: 'Kling Text to Video',
    shortName: 'Text to Video',
    description: 'Создание видео по текстовому описанию',
    category: 'video',
    taskType: 't2v',
    cost: 250,
    rating: 4.88,
    users: 56000,
    icon: '/icons/kling.svg',
    color: '#22c55e',
    backendModel: 'kling-2.6/text-to-video',
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    durations: ['5', '10'],
  },
  {
    id: 'kling-motion-control',
    provider: 'kling',
    name: 'Kling Motion Control',
    shortName: 'Motion Control',
    description: 'Перенос движений на фото и видео',
    category: 'video',
    taskType: 'motion',
    cost: 400,
    rating: 4.80,
    users: 28000,
    icon: '/icons/KlingMotion.svg',
    color: '#22c55e',
    backendModel: 'kling-2.6/motion-control',
    requiresImage: true,
    requiresVideo: true,
    durations: ['5', '10'],
  },
  {
    id: 'veo-t2v',
    provider: 'veo',
    name: 'Google Veo',
    shortName: 'Google Veo',
    description: 'Генерация видео от Google DeepMind',
    category: 'video',
    taskType: 't2v',
    cost: 200,
    rating: 4.87,
    users: 72000,
    icon: '/icons/veo.svg',
    color: '#ea4335',
    backendModel: 'veo-2.0-generate-001',
    aspectRatios: ['16:9', '9:16'],
    durations: ['5', '8'],
  },
  {
    id: 'sora-t2v',
    provider: 'sora',
    name: 'Sora',
    shortName: 'Sora',
    description: 'Генерация видео от OpenAI',
    category: 'video',
    taskType: 't2v',
    cost: 300,
    rating: 4.90,
    users: 95000,
    icon: '/icons/sora.svg',
    color: '#10a37f',
    backendModel: 'sora-2.0',
    aspectRatios: ['16:9', '9:16', '1:1'],
    durations: ['5', '10'],
  },
  {
    id: 'hailuo-t2v',
    provider: 'hailuo',
    name: 'Hailuo AI',
    shortName: '',
    description: 'Качественная генерация видео от MiniMax',
    category: 'video',
    taskType: 't2v',
    cost: 180,
    rating: 4.83,
    users: 61000,
    icon: '/icons/hailuo.svg',
    color: '#3b82f6',
    backendModel: 'hailuo/t2v',
    aspectRatios: ['16:9', '9:16'],
    durations: ['5'],
  },
  {
    id: 'runway-t2v',
    provider: 'runway',
    name: 'Runway Gen-3',
    shortName: 'Gen-3',
    description: 'Профессиональная генерация видео',
    category: 'video',
    taskType: 't2v',
    cost: 250,
    rating: 4.86,
    users: 78000,
    icon: '/icons/runway.svg',
    color: '#6d28d9',
    backendModel: 'runway/gen3a_turbo',
    aspectRatios: ['16:9', '9:16'],
    durations: ['5', '10'],
  },
  {
    id: 'seedance-t2v',
    provider: 'seedance',
    name: 'Seedance',
    shortName: 'Seedance',
    description: 'Генерация танцевальных и динамичных видео',
    category: 'video',
    taskType: 't2v',
    cost: 200,
    rating: 4.81,
    users: 43000,
    icon: '/icons/seedance.svg',
    color: '#059669',
    backendModel: 'seedance-1.0/t2v',
    aspectRatios: ['16:9', '9:16', '1:1'],
    durations: ['5'],
  },
]

export const CATEGORIES = [
  { id: 'all', name: 'Все', icon: '🔥' },
  { id: 'text', name: 'Текст', icon: '💬' },
  { id: 'image', name: 'Изображения', icon: '🖼️' },
  { id: 'video', name: 'Видео', icon: '🎬' }
]

export const getModelsByCategory = (category: string) => {
  if (category === 'all') return MODELS
  return MODELS.filter(m => m.category === category)
}

export const getPopularModels = () => {
  return [...MODELS].sort((a, b) => b.users - a.users).slice(0, 6)
}

export const getTextModels = () => {
  return MODELS.filter(m => m.category === 'text')
}

export const getImageModels = () => {
  return MODELS.filter(m => m.category === 'image')
}

export const getVideoModels = () => {
  return MODELS.filter(m => m.category === 'video')
}