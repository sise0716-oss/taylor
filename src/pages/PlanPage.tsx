import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { deductInventory } from '../db/inventoryOps'
import { suggestMeal, type SuggestedItem } from '../recommend/engine'
import type { MealType } from '../db/types'

const mealTypes: MealType[] = ['아침', '점심', '저녁', '간식']

export default function PlanPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [mealType, setMealType] = useState<MealType>('점심')
  const [draft, setDraft] = useState<SuggestedItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const ingredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), [])
  const inventory = useLiveQuery(() => db.inventory.toArray(), [])
  const existingMeal = useLiveQuery(
    () => db.meals.where({ date, mealType }).and((m) => m.status === 'confirmed').first(),
    [date, mealType],
  )
  const existingItems = useLiveQuery(
    () => (existingMeal ? db.mealItems.where('mealId').equals(existingMeal.id!).toArray() : []),
    [existingMeal],
  )

  const ingredientById = new Map((ingredients ?? []).map((i) => [i.id!, i]))
  const availableQty = new Map<number, number>()
  for (const item of inventory ?? []) {
    if (item.quantity <= 0) continue
    availableQty.set(item.ingredientId, (availableQty.get(item.ingredientId) ?? 0) + item.quantity)
  }

  async function generate() {
    setLoading(true)
    setDraft(await suggestMeal(mealType, date))
    setLoading(false)
  }

  function updateQty(idx: number, quantity: number) {
    if (!draft) return
    const next = [...draft]
    next[idx] = { ...next[idx], quantity }
    setDraft(next)
  }

  function removeItem(idx: number) {
    if (!draft) return
    setDraft(draft.filter((_, i) => i !== idx))
  }

  function addIngredient(ingredientId: number) {
    if (!draft) return
    if (draft.some((d) => d.ingredientId === ingredientId)) return
    const ing = ingredientById.get(ingredientId)
    if (!ing) return
    setDraft([...draft, { ingredientId, quantity: Math.min(40, availableQty.get(ingredientId) ?? 0), unit: ing.unit, reasons: ['직접 추가'] }])
  }

  async function confirmMeal() {
    if (!draft || draft.length === 0) return
    const mealId = (await db.meals.add({ date, mealType, status: 'confirmed', createdAt: new Date().toISOString() })) as number
    for (const item of draft) {
      await db.mealItems.add({ mealId, ingredientId: item.ingredientId, quantity: item.quantity, unit: item.unit })
      await deductInventory(item.ingredientId, item.quantity)
    }
    setDraft(null)
  }

  const unusedIngredients = (ingredients ?? []).filter(
    (ing) => (availableQty.get(ing.id!) ?? 0) > 0 && !draft?.some((d) => d.ingredientId === ing.id),
  )

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setDraft(null)
          }}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <select
          value={mealType}
          onChange={(e) => {
            setMealType(e.target.value as MealType)
            setDraft(null)
          }}
          className="rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          {mealTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {existingMeal ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="mb-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            이미 확정된 식단이에요
          </p>
          <ul className="flex flex-col gap-1">
            {existingItems?.map((item) => (
              <li key={item.id} className="text-sm text-neutral-700 dark:text-neutral-300">
                {ingredientById.get(item.ingredientId)?.name} {item.quantity}
                {item.unit}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            '기록' 탭에서 아기 반응을 기록해보세요.
          </p>
        </div>
      ) : draft == null ? (
        <div className="py-8 text-center">
          <p className="mb-3 text-sm text-neutral-500">현재 재고를 바탕으로 식단을 추천해드려요.</p>
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-full bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? '추천 중...' : '식단 추천받기'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {draft.length === 0 && (
            <p className="py-4 text-center text-sm text-neutral-400">
              추천 가능한 재료가 없어요. 재고를 추가하거나 아래에서 직접 담아보세요.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {draft.map((item, idx) => {
              const ing = ingredientById.get(item.ingredientId)
              const max = availableQty.get(item.ingredientId) ?? 0
              return (
                <li
                  key={item.ingredientId}
                  className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{ing?.name}</span>
                    <button onClick={() => removeItem(idx)} className="text-xs text-neutral-400">
                      삭제
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      value={item.quantity}
                      max={max}
                      onChange={(e) => updateQty(idx, Math.min(Number(e.target.value), max))}
                      className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <span className="text-xs text-neutral-400">
                      {item.unit} (최대 {max}
                      {item.unit})
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>

          {unusedIngredients.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && addIngredient(Number(e.target.value))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">+ 재료 직접 추가</option>
              {unusedIngredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} (재고 {availableQty.get(ing.id!)}
                  {ing.unit})
                </option>
              ))}
            </select>
          )}

          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setDraft(null)}
              className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm dark:border-neutral-700"
            >
              다시 추천받기
            </button>
            <button
              onClick={confirmMeal}
              disabled={draft.length === 0}
              className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              식단 확정 (재고 차감)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
