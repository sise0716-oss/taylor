import dayjs from 'dayjs'
import { useState } from 'react'
import DayPlanner from '../components/DayPlanner'
import WeekPlanner from '../components/WeekPlanner'
import type { MealType } from '../db/types'

type View = 'day' | 'week'

export default function PlanPage() {
  const [view, setView] = useState<View>('day')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [mealType, setMealType] = useState<MealType>('점심')

  return (
    <div className="p-4">
      <div className="mb-4 flex rounded-lg border border-neutral-200 p-1 text-sm dark:border-neutral-800">
        <button
          onClick={() => setView('day')}
          className={`flex-1 rounded-md py-1.5 ${
            view === 'day'
              ? 'bg-purple-600 text-white'
              : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          하루
        </button>
        <button
          onClick={() => setView('week')}
          className={`flex-1 rounded-md py-1.5 ${
            view === 'week'
              ? 'bg-purple-600 text-white'
              : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          주간
        </button>
      </div>

      {view === 'day' ? (
        <DayPlanner date={date} mealType={mealType} onDateChange={setDate} onMealTypeChange={setMealType} />
      ) : (
        <WeekPlanner
          anchorDate={date}
          onSelectSlot={(d, mt) => {
            setDate(d)
            setMealType(mt)
            setView('day')
          }}
        />
      )}
    </div>
  )
}
