export type Stage = '초기' | '중기' | '후기' | '완료기'

export type Category = '곡물' | '채소' | '과일' | '육류' | '어류' | '유제품' | '기타'

export type TasteTag = '단맛' | '고소함' | '신맛' | '감칠맛' | '담백함' | '쌉쌀함'

export type NutrientTag =
  | '탄수화물'
  | '단백질'
  | '철분'
  | '칼슘'
  | '비타민A'
  | '비타민C'
  | '식이섬유'
  | '지방'

export interface Ingredient {
  id?: number
  name: string
  category: Category
  unit: string
  minStage: Stage
  tasteTags: TasteTag[]
  nutrientTags: NutrientTag[]
  isAllergen: boolean
  createdAt: string
}

export type StorageLocation = '냉동' | '냉장' | '실온'

export interface InventoryItem {
  id?: number
  ingredientId: number
  quantity: number
  unit: string
  purchaseDate: string
  expirationDate: string
  location: StorageLocation
  createdAt: string
}

export type MealType = '아침' | '점심' | '저녁' | '간식'

export type MealStatus = 'suggested' | 'confirmed'

export interface Meal {
  id?: number
  date: string
  mealType: MealType
  status: MealStatus
  createdAt: string
}

export interface MealItem {
  id?: number
  mealId: number
  ingredientId: number
  quantity: number
  unit: string
}

export type AmountEaten = 'all' | 'most' | 'half' | 'little' | 'none'

export type Reaction = 'like' | 'neutral' | 'dislike' | 'allergy_suspected'

export interface Feedback {
  id?: number
  mealId: number
  amountEaten: AmountEaten
  reaction: Reaction
  notes?: string
  recordedAt: string
}

export interface BabyProfile {
  id?: number
  stage: Stage
  allergyIngredientIds: number[]
}
