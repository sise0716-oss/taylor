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

const categoryDefaults: Record<Category, { tasteTags: TasteTag[]; nutrientTags: NutrientTag[] }> = {
  곡물: { tasteTags: ['담백함'], nutrientTags: ['탄수화물'] },
  채소: { tasteTags: ['담백함'], nutrientTags: ['식이섬유'] },
  과일: { tasteTags: ['단맛'], nutrientTags: ['식이섬유'] },
  육류: { tasteTags: ['감칠맛'], nutrientTags: ['단백질'] },
  어류: { tasteTags: ['담백함'], nutrientTags: ['단백질'] },
  유제품: { tasteTags: ['고소함'], nutrientTags: ['칼슘'] },
  기타: { tasteTags: [], nutrientTags: [] },
}

interface BulkIngredientResult {
  line: string
  ok: boolean
  reason?: string
  name?: string
  category?: Category
  unit?: string
  minStage?: Stage
}

function parseBulkIngredientLine(line: string, existingNames: Set<string>): BulkIngredientResult {
  const parts = line.split(',').map((p) => p.trim())
  const [name, categoryRaw, unitRaw, minStageRaw] = parts

  if (!name) return { line, ok: false, reason: '이름 없음' }
  if (existingNames.has(name.toLowerCase())) return { line, ok: false, reason: '이미 등록된 재료' }

  const category = categories.includes(categoryRaw as Category) ? (categoryRaw as Category) : undefined
  if (!category) return { line, ok: false, reason: `카테고리가 올바르지 않음 (${categories.join('/')} 중 하나)` }

  const minStage = stages.includes(minStageRaw as Stage) ? (minStageRaw as Stage) : '중기'

  return { line, ok: true, name, category, unit: unitRaw || 'g', minStage }
}

export default function IngredientsPage() {
  const ingredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), [])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkResults, setBulkResults] = useState<BulkIngredientResult[] | null>(null)

  function parseBulk() {
    const existingNames = new Set((ingredients ?? []).map((i) => i.name.toLowerCase()))
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    setBulkResults(lines.map((line) => parseBulkIngredientLine(line, existingNames)))
  }

  async function commitBulk() {
    if (!bulkResults) return
    const now = new Date().toISOString()
    for (const r of bulkResults) {
      if (!r.ok) continue
      const defaults = categoryDefaults[r.category!]
      await db.ingredients.add({
        name: r.name!,
        category: r.category!,
        unit: r.unit!,
        minStage: r.minStage!,
        tasteTags: defaults.tasteTags,
        nutrientTags: defaults.nutrientTags,
        isAllergen: false,
        createdAt: now,
      })
    }
    setShowBulk(false)
    setBulkText('')
    setBulkResults(null)
  }

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
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="rounded-full border border-purple-600 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400"
          >
            여러 개 한번에
          </button>
          <button
            onClick={startCreate}
            className="rounded-full bg-purple-600 px-3 py-1.5 text-sm font-medium text-white active:bg-purple-700"
          >
            + 재료 추가
          </button>
        </div>
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

      {showBulk && (
        <div
          className="fixed inset-0 z-10 flex items-end bg-black/40"
          onClick={() => {
            setShowBulk(false)
            setBulkResults(null)
          }}
        >
          <div
            className="mx-auto flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-4 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">여러 개 한번에 입력</h3>
            <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
              한 줄에 하나씩, <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">이름, 카테고리, 단위, 시작단계</code> 형식으로 붙여넣으세요. 단위·시작단계는 생략 가능(기본 g, 중기).
              <br />
              카테고리: {categories.join(' / ')}
              <br />
              예: 퀴노아, 곡물, g, 중기
            </p>

            {!bulkResults ? (
              <>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={8}
                  placeholder={'퀴노아, 곡물, g, 중기\n오이, 채소'}
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setShowBulk(false)}
                    className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm dark:border-neutral-700"
                  >
                    취소
                  </button>
                  <button
                    onClick={parseBulk}
                    disabled={!bulkText.trim()}
                    className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  <ul className="flex flex-col gap-1.5">
                    {bulkResults.map((r, idx) => (
                      <li
                        key={idx}
                        className={`rounded-lg px-2 py-1.5 text-xs ${
                          r.ok
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {r.ok ? (
                          <>
                            ✓ {r.name} · {r.category} · {r.unit} · {r.minStage}부터
                          </>
                        ) : (
                          <>
                            ✗ "{r.line}" — {r.reason}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setBulkResults(null)}
                    className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm dark:border-neutral-700"
                  >
                    다시 수정
                  </button>
                  <button
                    onClick={commitBulk}
                    disabled={!bulkResults.some((r) => r.ok)}
                    className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {bulkResults.filter((r) => r.ok).length}개 재료 추가
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
