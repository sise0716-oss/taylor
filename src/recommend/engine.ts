import dayjs from 'dayjs'
import { ageInMonths, resolveStage } from '../db/age'
import { db } from '../db/db'
import type { BabyProfile, Ingredient, MealType, Stage } from '../db/types'

export interface SuggestedItem {
  ingredientId: number
  quantity: number
  unit: string
  reasons: string[]
}

export interface WeekSuggestion {
  date: string
  mealType: MealType
  items: SuggestedItem[]
}

const STAGE_ORDER: Stage[] = ['초기', '중기', '후기', '완료기']

// Typical total grams per meal, standard 이유식 단계별 급여량 가이드 기준
// (초기 1회 5~20g, 중기·후기 1회 30~50g×3주요군 ≈ 100~150g, 완료기 1회 100~200g)
const STAGE_DEFAULT_MEAL_TOTAL: Record<Stage, number> = {
  초기: 50,
  중기: 120,
  후기: 130,
  완료기: 160,
}
const SNACK_DEFAULT_TOTAL = 50

const RECENT_WINDOW_DAYS = 3
const BATCH_RECENT_WINDOW_DAYS = 6

const IRON_BOOST_MIN_MONTHS = 9
const IRON_BOOST_MAX_MONTHS = 24

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

// 중기 이유식 표준 비율(곡류 40~50% / 단백질 20~30% / 채소 20~30%, 채소 2~3종) 기준:
// 곡물 1 + 단백질 1 + 채소 3종을 슬롯으로 구성
function slotsForMealType(mealType: MealType): SlotGroup[] {
  if (mealType === '간식') {
    return [(ing) => ing.category === '과일' || ing.category === '유제품']
  }
  return [
    (ing) => ing.category === '곡물',
    isProtein,
    (ing) => ing.category === '채소',
    (ing) => ing.category === '채소',
    (ing) => ing.category === '채소',
  ]
}

function slotWeights(slotCount: number): number[] {
  if (slotCount === 1) return [1]
  if (slotCount === 5) return [0.5, 0.2, 0.1, 0.1, 0.1]
  return Array(slotCount).fill(1 / slotCount)
}

interface PlannedMeal {
  date: string
  mealType: MealType
  items: { ingredientId: number }[]
}

interface EngineContext {
  profile?: BabyProfile
  ingredients: Ingredient[]
  ingredientById: Map<number, Ingredient>
  qtyByIngredient: Map<number, number>
  nearestExpiryByIngredient: Map<number, string>
  feedbackScoreByIngredient: Map<number, number>
  confirmedMeals: PlannedMeal[]
}

async function loadContext(): Promise<EngineContext> {
  const [profiles, ingredients, inventory, meals, mealItems, feedbacks] = await Promise.all([
    db.profile.toArray(),
    db.ingredients.toArray(),
    db.inventory.toArray(),
    db.meals.toArray(),
    db.mealItems.toArray(),
    db.feedback.toArray(),
  ])

  const ingredientById = new Map(ingredients.map((i) => [i.id!, i]))

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

  const confirmedMeals: PlannedMeal[] = meals
    .filter((m) => m.status === 'confirmed')
    .map((m) => ({
      date: m.date,
      mealType: m.mealType,
      items: mealItems.filter((mi) => mi.mealId === m.id).map((mi) => ({ ingredientId: mi.ingredientId })),
    }))

  return {
    profile: profiles[0],
    ingredients,
    ingredientById,
    qtyByIngredient,
    nearestExpiryByIngredient,
    feedbackScoreByIngredient,
    confirmedMeals,
  }
}

function pickMeal(
  ctx: EngineContext,
  mealType: MealType,
  date: string,
  plannedMeals: PlannedMeal[],
  recentWindowDays: number = RECENT_WINDOW_DAYS,
): SuggestedItem[] {
  const stage = resolveStage(ctx.profile?.birthDate, dayjs(date))
  const ageMonths = ageInMonths(ctx.profile?.birthDate, dayjs(date))
  const ironBoostActive = ageMonths != null && ageMonths >= IRON_BOOST_MIN_MONTHS && ageMonths <= IRON_BOOST_MAX_MONTHS
  const allergyIds = new Set(ctx.profile?.allergyIngredientIds ?? [])
  const avoidIds = new Set(ctx.profile?.avoidIngredientIds ?? [])
  const mealTargetGrams = ctx.profile?.mealTargetGrams?.[mealType]
  const stageRank = STAGE_ORDER.indexOf(stage)

  const cutoff = dayjs(date).subtract(recentWindowDays, 'day').format('YYYY-MM-DD')
  const recentMeals = plannedMeals.filter((m) => m.date >= cutoff && m.date <= date)

  const lastUsedDaysAgo = new Map<number, number>()
  const recentCategoryCount = new Map<string, number>()
  for (const meal of recentMeals) {
    const daysAgo = dayjs(date).diff(dayjs(meal.date), 'day')
    for (const item of meal.items) {
      const prevDays = lastUsedDaysAgo.get(item.ingredientId)
      if (prevDays === undefined || daysAgo < prevDays) lastUsedDaysAgo.set(item.ingredientId, daysAgo)
      const ing = ctx.ingredientById.get(item.ingredientId)
      if (ing) recentCategoryCount.set(ing.category, (recentCategoryCount.get(ing.category) ?? 0) + 1)
    }
  }

  function score(ing: Ingredient): { total: number; reasons: string[] } {
    const reasons: string[] = []
    let total = 0

    const expiry = ctx.nearestExpiryByIngredient.get(ing.id!)
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
      total -= Math.max(0, recentWindowDays - daysAgo) * 2
      reasons.push(daysAgo === 0 ? '오늘 다른 끼니에도 사용됨' : `${daysAgo}일 전에도 먹음`)
    }

    const fb = ctx.feedbackScoreByIngredient.get(ing.id!)
    if (fb !== undefined) {
      total += fb
      if (fb > 0) reasons.push('아기가 잘 먹었던 재료')
      if (fb < 0) reasons.push('반응이 좋지 않았던 재료')
    }

    const recentCatCount = recentCategoryCount.get(ing.category) ?? 0
    total += Math.max(0, 3 - recentCatCount)

    if (ironBoostActive && ing.nutrientTags.includes('철분')) {
      total += 4
      reasons.push('철분 보강 필요 시기(9~24개월)')
    }

    return { total, reasons }
  }

  const eligible = ctx.ingredients.filter(
    (ing) =>
      STAGE_ORDER.indexOf(ing.minStage) <= stageRank &&
      !allergyIds.has(ing.id!) &&
      !avoidIds.has(ing.id!) &&
      (ctx.qtyByIngredient.get(ing.id!) ?? 0) > 0,
  )

  const slots = slotsForMealType(mealType)
  const weights = slotWeights(slots.length)
  const totalTarget = mealTargetGrams ?? (mealType === '간식' ? SNACK_DEFAULT_TOTAL : STAGE_DEFAULT_MEAL_TOTAL[stage])

  const picked: SuggestedItem[] = []
  const pickedIds = new Set<number>()

  slots.forEach((groupFilter, idx) => {
    const candidates = eligible
      .filter((ing) => groupFilter(ing) && !pickedIds.has(ing.id!))
      .map((ing) => ({ ing, ...score(ing) }))
      .sort((a, b) => b.total - a.total)

    const best = candidates[0]
    if (!best) return

    const available = ctx.qtyByIngredient.get(best.ing.id!) ?? 0
    const targetForSlot = Math.round(totalTarget * weights[idx])
    const quantity = Math.min(targetForSlot, available)
    if (quantity <= 0) return

    picked.push({
      ingredientId: best.ing.id!,
      quantity,
      unit: best.ing.unit,
      reasons: best.reasons.length ? best.reasons : ['영양 균형을 위해 선택'],
    })
    pickedIds.add(best.ing.id!)
  })

  return picked
}

export async function suggestMeal(mealType: MealType, date: string): Promise<SuggestedItem[]> {
  const ctx = await loadContext()
  return pickMeal(ctx, mealType, date, ctx.confirmedMeals)
}

/**
 * Generates suggestions for multiple date/mealType slots in one pass, carrying
 * inventory depletion and recency/variety tracking forward from one slot to
 * the next so a whole week can be planned coherently in a single call.
 * Nothing is persisted — the caller decides what to confirm.
 */
export async function suggestBatch(slots: { date: string; mealType: MealType }[]): Promise<WeekSuggestion[]> {
  const ctx = await loadContext()
  const planned = [...ctx.confirmedMeals]
  const results: WeekSuggestion[] = []

  for (const { date, mealType } of slots) {
    const items = pickMeal(ctx, mealType, date, planned, BATCH_RECENT_WINDOW_DAYS)
    if (items.length === 0) continue

    results.push({ date, mealType, items })

    for (const item of items) {
      const remaining = (ctx.qtyByIngredient.get(item.ingredientId) ?? 0) - item.quantity
      ctx.qtyByIngredient.set(item.ingredientId, Math.max(0, remaining))
    }
    planned.push({ date, mealType, items: items.map((i) => ({ ingredientId: i.ingredientId })) })
  }

  return results
}
