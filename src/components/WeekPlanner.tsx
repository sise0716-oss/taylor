import dayjs, { type Dayjs } from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import type { MealType } from '../db/types'

const mealTypes: MealType[] = ['아침', '점심', '저녁', '간식']
const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

function startOfWeek(d: Dayjs): Dayjs {
  const day = d.day()
  const diff = day === 0 ? 6 : day - 1
  return d.subtract(diff, 'day').startOf('day')
}

interface Props {
  anchorDate: string
  onSelectSlot: (date: string, mealType: MealType) => void
}

export default function WeekPlanner({ anchorDate, onSelectSlot }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(dayjs(anchorDate)))
  const weekEnd = weekStart.add(6, 'day')
  const today = dayjs().format('YYYY-MM-DD')

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))

  const meals = useLiveQuery(
    () =>
      db.meals
        .where('date')
        .between(weekStart.format('YYYY-MM-DD'), weekEnd.format('YYYY-MM-DD'), true, true)
        .and((m) => m.status === 'confirmed')
        .toArray(),
    [weekStart.format('YYYY-MM-DD')],
  )
  const mealItems = useLiveQuery(() => db.mealItems.toArray(), [])
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), [])

  const ingredientById = new Map((ingredients ?? []).map((i) => [i.id!, i]))
  const mealByKey = new Map((meals ?? []).map((m) => [`${m.date}|${m.mealType}`, m]))

  function summaryFor(date: string, mealType: MealType) {
    const meal = mealByKey.get(`${date}|${mealType}`)
    if (!meal) return null
    const items = (mealItems ?? []).filter((mi) => mi.mealId === meal.id)
    return items.map((i) => ingredientById.get(i.ingredientId)?.name).filter(Boolean).join(', ')
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setWeekStart(weekStart.subtract(7, 'day'))}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          ← 지난주
        </button>
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {weekStart.format('M/D')} - {weekEnd.format('M/D')}
        </span>
        <button
          onClick={() => setWeekStart(weekStart.add(7, 'day'))}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          다음주 →
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {days.map((d, idx) => {
          const dateStr = d.format('YYYY-MM-DD')
          const isToday = dateStr === today
          return (
            <li
              key={dateStr}
              className={`rounded-xl border p-3 ${
                isToday
                  ? 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40'
                  : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
              }`}
            >
              <div className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {d.format('M/D')} ({weekdayLabels[idx]}){isToday && ' · 오늘'}
              </div>
              <div className="flex flex-col gap-1.5">
                {mealTypes.map((mt) => {
                  const summary = summaryFor(dateStr, mt)
                  return (
                    <button
                      key={mt}
                      onClick={() => onSelectSlot(dateStr, mt)}
                      className="flex items-center gap-2 rounded-lg border border-neutral-100 px-2 py-1.5 text-left text-xs dark:border-neutral-800"
                    >
                      <span className="w-8 shrink-0 text-neutral-500 dark:text-neutral-400">{mt}</span>
                      {summary ? (
                        <span className="truncate text-neutral-700 dark:text-neutral-300">{summary}</span>
                      ) : (
                        <span className="truncate text-neutral-400">미정 · 눌러서 계획하기</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
