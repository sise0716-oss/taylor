import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import type { AmountEaten, Reaction } from '../db/types'

const amountOptions: { value: AmountEaten; label: string }[] = [
  { value: 'all', label: '전량' },
  { value: 'most', label: '대부분' },
  { value: 'half', label: '절반' },
  { value: 'little', label: '조금' },
  { value: 'none', label: '안 먹음' },
]

const reactionOptions: { value: Reaction; label: string }[] = [
  { value: 'like', label: '좋아함 🙂' },
  { value: 'neutral', label: '보통 😐' },
  { value: 'dislike', label: '싫어함 🙁' },
  { value: 'allergy_suspected', label: '알레르기 의심 ⚠️' },
]

function FeedbackForm({ mealId }: { mealId: number }) {
  const [amountEaten, setAmountEaten] = useState<AmountEaten>('most')
  const [reaction, setReaction] = useState<Reaction>('neutral')
  const [notes, setNotes] = useState('')

  async function save() {
    await db.feedback.add({ mealId, amountEaten, reaction, notes: notes.trim() || undefined, recordedAt: new Date().toISOString() })
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
      <div>
        <p className="mb-1 text-xs text-neutral-500">먹은 양</p>
        <div className="flex flex-wrap gap-1.5">
          {amountOptions.map((o) => (
            <button
              key={o.value}
              onClick={() => setAmountEaten(o.value)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                amountEaten === o.value
                  ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                  : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-neutral-500">반응</p>
        <div className="flex flex-wrap gap-1.5">
          {reactionOptions.map((o) => (
            <button
              key={o.value}
              onClick={() => setReaction(o.value)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                reaction === o.value
                  ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                  : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="메모 (선택)"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
      />
      <button onClick={save} className="rounded-lg bg-purple-600 py-2 text-sm font-medium text-white">
        저장
      </button>
    </div>
  )
}

export default function HistoryPage() {
  const meals = useLiveQuery(
    async () => {
      const confirmed = await db.meals.where('status').equals('confirmed').toArray()
      return confirmed.sort((a, b) => b.date.localeCompare(a.date))
    },
    [],
  )
  const mealItems = useLiveQuery(() => db.mealItems.toArray(), [])
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), [])
  const feedbacks = useLiveQuery(() => db.feedback.toArray(), [])

  const ingredientById = new Map((ingredients ?? []).map((i) => [i.id!, i]))

  return (
    <div className="p-4">
      <h2 className="mb-4 text-base font-semibold text-neutral-900 dark:text-neutral-100">식사 기록</h2>

      <ul className="flex flex-col gap-3">
        {meals?.map((meal) => {
          const items = (mealItems ?? []).filter((mi) => mi.mealId === meal.id)
          const feedback = (feedbacks ?? []).find((fb) => fb.mealId === meal.id)
          const reactionLabel = reactionOptions.find((o) => o.value === feedback?.reaction)?.label
          const amountLabel = amountOptions.find((o) => o.value === feedback?.amountEaten)?.label

          return (
            <li
              key={meal.id}
              className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{meal.date}</span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {meal.mealType}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {items.map((i) => `${ingredientById.get(i.ingredientId)?.name} ${i.quantity}${i.unit}`).join(', ')}
              </p>

              {feedback ? (
                <div className="mt-2 flex gap-1.5 border-t border-neutral-100 pt-2 text-xs dark:border-neutral-800">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">{amountLabel}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">{reactionLabel}</span>
                  {feedback.notes && <span className="text-neutral-400">{feedback.notes}</span>}
                </div>
              ) : (
                <FeedbackForm mealId={meal.id!} />
              )}
            </li>
          )
        })}
        {meals?.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-400">확정된 식단이 아직 없어요.</p>
        )}
      </ul>
    </div>
  )
}
