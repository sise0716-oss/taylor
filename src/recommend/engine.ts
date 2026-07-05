import dayjs from 'dayjs'
import { db } from '../db/db'
import type { Ingredient, MealType, Stage } from '../db/types'

export interface SuggestedItem {
  ingredientId: number
  quantity: number
  unit: string
  reasons: string[]
}

const STAGE_ORDER: Stage[] = ['초기', '중기', '후기', '완료기']

const STAGE_DEFAULT_QTY: Record<Stage, number> = {
  초기: 20,
  중기: 40,
  후기: 60,
  완료기: 80,
}

const RECENT_WINDOW_DAYS = 3

const REACTION_WEIGHT: Record<string, number> = {
  like: 2,
  neutral: 0,
  dislike: -2,
  allergy_suspected: -1000,
}

const AMOUNT_WEIGHT: Record<string, number> = {
  all: 1,
  most: 0.7,
  half: 0.3,
  little: -0.3,
  none: -0.7,
}

function isProtein(ing: Ingredient) {
  return ing.category === '육류' || ing.category === '어류' || ing.nutrientTags.includes('단백질')
}

type SlotGroup = (ing: Ingredient) => boolean

function slotsForMealType(mealType: MealType): SlotGroup[] {
  if (mealType === '간식') {
    return [(ing) => ing.category === '과일' || ing.category === '유제품']
  }
  return [
    (ing) => ing.category === '곡물',
    isProtein,
    (ing) => ing.category === '채소',
  ]
}

export async function suggestMeal(mealType: MealType, date: string): Promise<SuggestedItem[]> {
  const [profiles, ingredients, inventory, meals, mealItems, feedbacks] = await Promise.all([
    db.profile.toArray(),
    db.ingredients.toArray(),
    db.inventory.toArray(),
    db.meals.toArray(),
    db.mealItems.toArray(),
    db.feedback.toArray(),
  ])

  const stage = profiles[0]?.stage ?? '중기'
  const allergyIds = new Set(profiles[0]?.allergyIngredientIds ?? [])
  const stageRank = STAGE_ORDER.indexOf(stage)

  const qtyByIngredient = new Map<number, number>()
  const nearestExpiryByIngredient = new Map<number, string>()
  for (const item of inventory) {
    if (item.quantity <= 0) continue
    qtyByIngredient.set(item.ingredientId, (qtyByIngredient.get(item.ingredientId) ?? 0) + item.quantity)
    const prev = nearestExpiryByIngredient.get(item.ingredientId)
    if (!prev || item.expirationDate < prev) {
      nearestExpiryByIngredient.set(item.ingredientId, item.expirationDate)
    }
  }

  const cutoff = dayjs(date).subtract(RECENT_WINDOW_DAYS, 'day').format('YYYY-MM-DD')
  const recentMealIds = new Set(
    meals.filter((m) => m.status === 'confirmed' && m.date >= cutoff && m.date < date).map((m) => m.id!),
  )
  const lastUsedDaysAgo = new Map<number, number>()
  const recentCategoryCount = new Map<string, number>()
  const ingredientById = new Map(ingredients.map((i) => [i.id!, i]))

  for (const mi of mealItems) {
    if (!recentMealIds.has(mi.mealId)) continue
    const meal = meals.find((m) => m.id === mi.mealId)
    if (!meal) continue
    const daysAgo = dayjs(date).diff(dayjs(meal.date), 'day')
    const prevDays = lastUsedDaysAgo.get(mi.ingredientId)
    if (prevDays === undefined || daysAgo < prevDays) lastUsedDaysAgo.set(mi.ingredientId, daysAgo)

    const ing = ingredientById.get(mi.ingredientId)
    if (ing) recentCategoryCount.set(ing.category, (recentCategoryCount.get(ing.category) ?? 0) + 1)
  }

  const feedbackScoreByIngredient = new Map<number, number>()
  for (const fb of feedbacks) {
    const meal = meals.find((m) => m.id === fb.mealId)
    if (!meal) continue
    const itemsOfMeal = mealItems.filter((mi) => mi.mealId === fb.mealId)
    const score = REACTION_WEIGHT[fb.reaction] + AMOUNT_WEIGHT[fb.amountEaten]
    for (const mi of itemsOfMeal) {
      feedbackScoreByIngredient.set(mi.ingredientId, (feedbackScoreByIngredient.get(mi.ingredientId) ?? 0) + score)
    }
  }

  function score(ing: Ingredient): { total: number; reasons: string[] } {
    const reasons: string[] = []
    let total = 0

    const expiry = nearestExpiryByIngredient.get(ing.id!)
    if (expiry) {
      const daysLeft = dayjs(expiry).diff(dayjs(date), 'day')
      if (daysLeft <= 3) {
        const bonus = Math.max(0, 10 - daysLeft * 2)
        total += bonus
        reasons.push(daysLeft <= 0 ? '유통기한 임박' : `유통기한 ${daysLeft}일 남음`)
      }
    }

    const daysAgo = lastUsedDaysAgo.get(ing.id!)
    if (daysAgo === undefined) {
      total += 3
      reasons.push('최근에 안 먹어본 재료')
    } else {
      total -= Math.max(0, 3 - daysAgo) * 2
    }

    const fb = feedbackScoreByIngredient.get(ing.id!)
    if (fb !== undefined) {
      total += fb
      if (fb > 0) reasons.push('아기가 잘 먹었던 재료')
      if (fb < 0) reasons.push('반응이 좋지 않았던 재료')
    }

    const recentCatCount = recentCategoryCount.get(ing.category) ?? 0
    total += Math.max(0, 3 - recentCatCount)

    return { total, reasons }
  }

  const eligible = ingredients.filter(
    (ing) => STAGE_ORDER.indexOf(ing.minStage) <= stageRank && !allergyIds.has(ing.id!) && (qtyByIngredient.get(ing.id!) ?? 0) > 0,
  )

  const slots = slotsForMealType(mealType)
  const picked: SuggestedItem[] = []
  const pickedIds = new Set<number>()

  for (const groupFilter of slots) {
    const candidates = eligible
      .filter((ing) => groupFilter(ing) && !pickedIds.has(ing.id!))
      .map((ing) => ({ ing, ...score(ing) }))
      .sort((a, b) => b.total - a.total)

    const best = candidates[0]
    if (!best) continue

    const available = qtyByIngredient.get(best.ing.id!) ?? 0
    const quantity = Math.min(STAGE_DEFAULT_QTY[stage], available)

    picked.push({
      ingredientId: best.ing.id!,
      quantity,
      unit: best.ing.unit,
      reasons: best.reasons.length ? best.reasons : ['영양 균형을 위해 선택'],
    })
    pickedIds.add(best.ing.id!)
  }

  return picked
}
