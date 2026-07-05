import { db } from './db'
import type { Ingredient } from './types'

const seedIngredients: Omit<Ingredient, 'id' | 'createdAt'>[] = [
  { name: '쌀미음', category: '곡물', unit: 'g', minStage: '초기', tasteTags: ['담백함'], nutrientTags: ['탄수화물'], isAllergen: false },
  { name: '현미', category: '곡물', unit: 'g', minStage: '중기', tasteTags: ['고소함', '담백함'], nutrientTags: ['탄수화물', '식이섬유'], isAllergen: false },
  { name: '단호박', category: '채소', unit: 'g', minStage: '초기', tasteTags: ['단맛'], nutrientTags: ['비타민A', '식이섬유'], isAllergen: false },
  { name: '브로콜리', category: '채소', unit: 'g', minStage: '초기', tasteTags: ['담백함'], nutrientTags: ['비타민C', '식이섬유'], isAllergen: false },
  { name: '고구마', category: '채소', unit: 'g', minStage: '초기', tasteTags: ['단맛'], nutrientTags: ['탄수화물', '식이섬유'], isAllergen: false },
  { name: '당근', category: '채소', unit: 'g', minStage: '초기', tasteTags: ['단맛'], nutrientTags: ['비타민A'], isAllergen: false },
  { name: '시금치', category: '채소', unit: 'g', minStage: '중기', tasteTags: ['담백함'], nutrientTags: ['철분', '비타민A'], isAllergen: false },
  { name: '애호박', category: '채소', unit: 'g', minStage: '초기', tasteTags: ['담백함'], nutrientTags: ['비타민C'], isAllergen: false },
  { name: '사과', category: '과일', unit: 'g', minStage: '초기', tasteTags: ['단맛', '신맛'], nutrientTags: ['식이섬유', '비타민C'], isAllergen: false },
  { name: '바나나', category: '과일', unit: 'g', minStage: '초기', tasteTags: ['단맛'], nutrientTags: ['탄수화물', '식이섬유'], isAllergen: false },
  { name: '배', category: '과일', unit: 'g', minStage: '초기', tasteTags: ['단맛'], nutrientTags: ['식이섬유'], isAllergen: false },
  { name: '닭고기 안심', category: '육류', unit: 'g', minStage: '중기', tasteTags: ['담백함', '감칠맛'], nutrientTags: ['단백질'], isAllergen: false },
  { name: '소고기 안심', category: '육류', unit: 'g', minStage: '중기', tasteTags: ['감칠맛'], nutrientTags: ['단백질', '철분'], isAllergen: false },
  { name: '흰살생선(대구)', category: '어류', unit: 'g', minStage: '중기', tasteTags: ['담백함'], nutrientTags: ['단백질'], isAllergen: true },
  { name: '두부', category: '기타', unit: 'g', minStage: '중기', tasteTags: ['담백함'], nutrientTags: ['단백질', '칼슘'], isAllergen: true },
  { name: '달걀노른자', category: '기타', unit: '개', minStage: '중기', tasteTags: ['고소함'], nutrientTags: ['단백질', '지방'], isAllergen: true },
  { name: '아기치즈', category: '유제품', unit: 'g', minStage: '후기', tasteTags: ['고소함'], nutrientTags: ['칼슘', '지방'], isAllergen: true },
  { name: '플레인 요거트', category: '유제품', unit: 'g', minStage: '후기', tasteTags: ['신맛'], nutrientTags: ['칼슘', '단백질'], isAllergen: true },
  { name: '양배추', category: '채소', unit: 'g', minStage: '초기', tasteTags: ['담백함'], nutrientTags: ['비타민C', '식이섬유'], isAllergen: false },
  { name: '완두콩', category: '채소', unit: 'g', minStage: '중기', tasteTags: ['단맛'], nutrientTags: ['단백질', '식이섬유'], isAllergen: false },
]

export async function seedIfEmpty() {
  const count = await db.ingredients.count()
  if (count > 0) return

  const now = new Date().toISOString()
  await db.ingredients.bulkAdd(seedIngredients.map((ing) => ({ ...ing, createdAt: now })))

  const profileCount = await db.profile.count()
  if (profileCount === 0) {
    await db.profile.add({ stage: '중기', allergyIngredientIds: [] })
  }
}
