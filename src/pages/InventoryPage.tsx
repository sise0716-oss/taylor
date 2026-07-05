import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import type { InventoryItem, StorageLocation } from '../db/types'

const locations: StorageLocation[] = ['냉동', '냉장', '실온']

const todayISO = () => dayjs().format('YYYY-MM-DD')

function expiryBadge(expirationDate: string) {
  const daysLeft = dayjs(expirationDate).startOf('day').diff(dayjs().startOf('day'), 'day')
  if (daysLeft < 0)
    return { text: '유통기한 지남', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' }
  if (daysLeft <= 3)
    return {
      text: `D-${daysLeft} 임박`,
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    }
  return {
    text: `D-${daysLeft}`,
    className: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  }
}

const emptyForm = {
  ingredientId: 0,
  quantity: 100,
  unit: 'g',
  purchaseDate: todayISO(),
  expirationDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  location: '냉동' as StorageLocation,
}

export default function InventoryPage() {
  const ingredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), [])
  const inventory = useLiveQuery(() => db.inventory.orderBy('expirationDate').toArray(), [])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const ingredientMap = new Map((ingredients ?? []).map((i) => [i.id!, i]))

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, ingredientId: ingredients?.[0]?.id ?? 0, unit: ingredients?.[0]?.unit ?? 'g' })
    setShowForm(true)
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.id!)
    setForm({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
      purchaseDate: item.purchaseDate,
      expirationDate: item.expirationDate,
      location: item.location,
    })
    setShowForm(true)
  }

  async function submit() {
    if (!form.ingredientId) return
    if (editingId == null) {
      await db.inventory.add({ ...form, createdAt: new Date().toISOString() })
    } else {
      await db.inventory.update(editingId, { ...form })
    }
    setShowForm(false)
  }

  async function remove(id: number) {
    await db.inventory.delete(id)
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          재고 목록
        </h2>
        <button
          onClick={startCreate}
          disabled={!ingredients?.length}
          className="rounded-full bg-purple-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          + 재고 추가
        </button>
      </div>

      {!ingredients?.length && (
        <p className="py-8 text-center text-sm text-neutral-400">
          먼저 '재료' 탭에서 재료를 등록해주세요.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {inventory?.map((item) => {
          const ing = ingredientMap.get(item.ingredientId)
          const badge = expiryBadge(item.expirationDate)
          return (
            <li
              key={item.id}
              className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {ing?.name ?? '(삭제된 재료)'}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${badge.className}`}>{badge.text}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {item.quantity}
                    {item.unit} · {item.location} · 유통기한 {item.expirationDate}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button onClick={() => startEdit(item)} className="text-purple-600 dark:text-purple-400">
                    수정
                  </button>
                  <button onClick={() => remove(item.id!)} className="text-neutral-400">
                    삭제
                  </button>
                </div>
              </div>
            </li>
          )
        })}
        {inventory?.length === 0 && ingredients?.length ? (
          <p className="py-8 text-center text-sm text-neutral-400">등록된 재고가 없어요.</p>
        ) : null}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/40" onClick={() => setShowForm(false)}>
          <div
            className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-semibold text-neutral-900 dark:text-neutral-100">
              {editingId == null ? '재고 추가' : '재고 수정'}
            </h3>

            <div className="flex flex-col gap-3">
              <select
                value={form.ingredientId}
                onChange={(e) => {
                  const id = Number(e.target.value)
                  const ing = ingredientMap.get(id)
                  setForm({ ...form, ingredientId: id, unit: ing?.unit ?? form.unit })
                }}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              >
                {ingredients?.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                  placeholder="수량"
                />
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                />
                <select
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value as StorageLocation })}
                  className="rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {locations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex flex-col gap-1 text-xs text-neutral-500">
                구매일
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-neutral-500">
                유통기한
                <input
                  type="date"
                  value={form.expirationDate}
                  onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
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
