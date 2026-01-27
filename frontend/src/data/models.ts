export type ModelCategory = 'text' | 'image' | 'video'
export type TaskType = 'text' | 't2i' | 'i2i' | 't2v' | 'i2v' | 'avatar' | 'motion'

export interface Model {
  id: string
  provider: string
  name: string
  description: string
  category: ModelCategory
  taskType: TaskType
  cost: number
  rating: number
  users: number
  icon: string
  color: string
  backendModel: string
  requiresImage?: boolean
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
    description: 'Новейшая модель от OpenAI для текста и изображений',
    category: 'text',
    taskType: 'text',
    cost: 30,
    rating: 4.98,
    users: 165000,
    icon: '🤖',
    color: '#10a37f',
    backendModel: 'gpt-4o'
  },
  {
    id: 'claude-sonnet-4.5',
    provider: 'anthropic',
    name: 'Claude Sonnet 4.5',
    description: 'Продвинутая модель от Anthropic для сложных задач',
    category: 'text',
    taskType: 'text',
    cost: 25,
    rating: 4.95,
    users: 89000,
    icon: '🧠',
    color: '#d97706',
    backendModel: 'claude-sonnet-4-5-20250929'
  },
  {
    id: 'gemini-3-pro',
    provider: 'gemini',
    name: 'Gemini 3 Pro',
    description: 'Мощная мультимодальная модель от Google',
    category: 'text',
    taskType: 'text',
    cost: 20,
    rating: 4.90,
    users: 156000,
    icon: '✨',
    color: '#4285f4',
    backendModel: 'gemini-2.0-flash'
  },
  {
    id: 'gemini-3-flash',
    provider: 'gemini',
    name: 'Gemini 3 Flash',
    description: 'Быстрая модель от Google для простых задач',
    category: 'text',
    taskType: 'text',
    cost: 5,
    rating: 4.85,
    users: 203000,
    icon: '⚡',
    color: '#4285f4',
    backendModel: 'gemini-1.5-flash'
  },
  {
    id: 'deepseek-3.2-chat',
    provider: 'deepseek',
    name: 'DeepSeek 3.2 Chat',
    description: 'Бесплатная модель для быстрых ответов',
    category: 'text',
    taskType: 'text',
    cost: 0,
    rating: 4.70,
    users: 234000,
    icon: '🔍',
    color: '#6366f1',
    backendModel: 'deepseek-chat'
  },
  {
    id: 'nanobanana-pro',
    provider: 'nano_banana',
    name: 'Nano Banana Pro',
    description: 'Лучшая нейросеть для генерации изображений',
    category: 'image',
    taskType: 't2i',
    cost: 55,
    rating: 4.90,
    users: 93000,
    icon: '🍌',
    color: '#eab308',
    backendModel: 'nano-banana-pro',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    resolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'nanobanana-standard',
    provider: 'nano_banana',
    name: 'Nano Banana Standard',
    description: 'Базовая версия генератора изображений',
    category: 'image',
    taskType: 't2i',
    cost: 25,
    rating: 4.75,
    users: 145000,
    icon: '🍌',
    color: '#eab308',
    backendModel: 'google/nano-banana',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    resolutions: ['1K', '2K'],
  },
  {
    id: 'midjourney-t2i',
    provider: 'midjourney',
    name: 'Midjourney Text to Image',
    description: 'Генерация изображений по текстовому описанию',
    category: 'image',
    taskType: 't2i',
    cost: 30,
    rating: 4.95,
    users: 320000,
    icon: '🎨',
    color: '#0d9488',
    backendModel: 'mj_txt2img',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
  },
  {
    id: 'midjourney-i2i',
    provider: 'midjourney',
    name: 'Midjourney Image to Image',
    description: 'Преобразование и стилизация изображений',
    category: 'image',
    taskType: 'i2i',
    cost: 35,
    rating: 4.88,
    users: 180000,
    icon: '🖼️',
    color: '#0d9488',
    backendModel: 'mj_img2img',
    requiresImage: true,
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
  },
  {
    id: 'midjourney-i2v',
    provider: 'midjourney',
    name: 'Midjourney Image to Video',
    description: 'Создание видео из статичных изображений',
    category: 'video',
    taskType: 'i2v',
    cost: 100,
    rating: 4.80,
    users: 67000,
    icon: '🎬',
    color: '#0d9488',
    backendModel: 'mj_video',
    requiresImage: true,
  },
  {
    id: 'kling-avatar-pro',
    provider: 'kling',
    name: 'Kling Avatar Pro',
    description: 'Создание реалистичных аватаров с анимацией',
    category: 'video',
    taskType: 'avatar',
    cost: 150,
    rating: 4.85,
    users: 45000,
    icon: '👤',
    color: '#22c55e',
    backendModel: 'kling/ai-avatar-pro',
    requiresImage: true,
  },
  {
    id: 'kling-2.6-i2v',
    provider: 'kling',
    name: 'Kling 2.6 Image to Video',
    description: 'Генерация видео из изображений нового поколения',
    category: 'video',
    taskType: 'i2v',
    cost: 200,
    rating: 4.92,
    users: 89000,
    icon: '🎥',
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
    description: 'Создание видео по текстовому описанию',
    category: 'video',
    taskType: 't2v',
    cost: 250,
    rating: 4.88,
    users: 56000,
    icon: '📹',
    color: '#22c55e',
    backendModel: 'kling-2.6/text-to-video',
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    durations: ['5', '10'],
  },
  {
    id: 'kling-motion-control',
    provider: 'kling',
    name: 'Kling Motion Control',
    description: 'Перенос движений на фото и видео',
    category: 'video',
    taskType: 'motion',
    cost: 400,
    rating: 4.80,
    users: 28000,
    icon: '🕺',
    color: '#22c55e',
    backendModel: 'kling-2.6/motion-control',
    requiresImage: true,
    requiresVideo: true,
    durations: ['5', '10'],
  }
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
