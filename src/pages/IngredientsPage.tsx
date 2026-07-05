import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import type { Category, Ingredient, NutrientTag, Stage, TasteTag } from '../db/types'

const categories: Category[] = ['곡물', '채소', '과일', '육류', '어류', '유제품', '기타']
const stages: Stage[] = ['초기', '중기', '후기', '완료기']
const tasteOptions: TasteTag[] = ['단맛', '고소함', '신맛', '감칠맛', '담백함', '쌉쌀함']
const nutrientOptions: NutrientTag[] = [
  '탄수화물',
  '단백질',
  '철분',
  '칼슘',
  '비타민A',
  '비타민C',
  '식이섬유',
  '지방',
]

const emptyForm = {
  name: '',
  category: '채소' as Category,
  unit: 'g',
  minStage: '초기' as Stage,
  tasteTags: [] as TasteTag[],
  nutrientTags: [] as NutrientTag[],
  isAllergen: false,
}

export default function IngredientsPage() {
  const ingredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), [])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function startEdit(ing: Ingredient) {
    setEditingId(ing.id!)
    setForm({
      name: ing.name,
      category: ing.category,
      unit: ing.unit,
      minStage: ing.minStage,
      tasteTags: ing.tasteTags,
      nutrientTags: ing.nutrientTags,
      isAllergen: ing.isAllergen,
    })
    setShowForm(true)
  }

  async function submit() {
    if (!form.name.trim()) return
    if (editingId == null) {
      await db.ingredients.add({ ...form, createdAt: new Date().toISOString() })
    } else {
      await db.ingredients.update(editingId, { ...form })
    }
    setShowForm(false)
  }

  async function remove(id: number) {
    await db.ingredients.delete(id)
  }

  function toggleTag<T extends string>(list: T[], tag: T): T[] {
    return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          재료 목록
        </h2>
        <button
          onClick={startCreate}
          className="rounded-full bg-purple-600 px-3 py-1.5 text-sm font-medium text-white active:bg-purple-700"
        >
          + 재료 추가
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {ingredients?.map((ing) => (
          <li
            key={ing.id}
            className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {ing.name}
                  </span>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {ing.category}
                  </span>
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {ing.minStage}~
                  </span>
                  {ing.isAllergen && (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                      알레르기 주의
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {[...ing.tasteTags, ...ing.nutrientTags].map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button onClick={() => startEdit(ing)} className="text-purple-600 dark:text-purple-400">
                  수정
                </button>
                <button onClick={() => remove(ing.id!)} className="text-neutral-400">
                  삭제
                </button>
              </div>
            </div>
          </li>
        ))}
        {ingredients?.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-400">등록된 재료가 없어요.</p>
        )}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/40" onClick={() => setShowForm(false)}>
          <div
            className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-semibold text-neutral-900 dark:text-neutral-100">
              {editingId == null ? '재료 추가' : '재료 수정'}
            </h3>

            <div className="flex flex-col gap-3">
              <input
                placeholder="재료 이름"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              />

              <div className="flex gap-2">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  className="flex-1 rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={form.minStage}
                  onChange={(e) => setForm({ ...form, minStage: e.target.value as Stage })}
                  className="flex-1 rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {s}부터
                    </option>
                  ))}
                </select>
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                  placeholder="단위"
                />
              </div>

              <div>
                <p className="mb-1 text-xs text-neutral-500">맛</p>
                <div className="flex flex-wrap gap-1.5">
                  {tasteOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setForm({ ...form, tasteTags: toggleTag(form.tasteTags, tag) })}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        form.tasteTags.includes(tag)
                          ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs text-neutral-500">영양</p>
                <div className="flex flex-wrap gap-1.5">
                  {nutrientOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, nutrientTags: toggleTag(form.nutrientTags, tag) })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        form.nutrientTags.includes(tag)
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={form.isAllergen}
                  onChange={(e) => setForm({ ...form, isAllergen: e.target.checked })}
                />
                알레르기 주의 재료
              </label>

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm dark:border-neutral-700"
                >
                  취소
                </button>
                <button
                  onClick={submit}
                  className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
