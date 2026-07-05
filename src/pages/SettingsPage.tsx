import { useLiveQuery } from 'dexie-react-hooks'
import { ageGuideline, ageInMonths } from '../db/age'
import { db } from '../db/db'
import SearchSelect from '../components/SearchSelect'
import type { MealType } from '../db/types'

const mealTypes: MealType[] = ['아침', '점심', '저녁', '간식']
const MEAL_TARGET_TOLERANCE = 10

export default function SettingsPage() {
  const profile = useLiveQuery(() => db.profile.toCollection().first(), [])
  const ingredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), [])

  const ingredientById = new Map((ingredients ?? []).map((i) => [i.id!, i]))
  const months = profile ? ageInMonths(profile.birthDate) : null
  const guide = months != null ? ageGuideline(months) : null

  async function update(patch: Partial<NonNullable<typeof profile>>) {
    if (!profile?.id) return
    await db.profile.update(profile.id, patch)
  }

  function addToList(field: 'allergyIngredientIds' | 'avoidIngredientIds', ingredientId: number) {
    if (!profile) return
    if (profile[field].includes(ingredientId)) return
    update({ [field]: [...profile[field], ingredientId] })
  }

  function removeFromList(field: 'allergyIngredientIds' | 'avoidIngredientIds', ingredientId: number) {
    if (!profile) return
    update({ [field]: profile[field].filter((id) => id !== ingredientId) })
  }

  if (!profile) return null

  return (
    <div className="flex flex-col gap-5 p-4">
      <section>
        <h2 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">아기 정보</h2>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          생년월일
          <input
            type="date"
            value={profile.birthDate}
            onChange={(e) => update({ birthDate: e.target.value })}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </label>
        {months != null ? (
          <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            현재 <span className="font-medium text-neutral-900 dark:text-neutral-100">만 {months}개월</span> ·{' '}
            <span className="font-medium text-purple-600 dark:text-purple-400">{guide?.stageLabel}</span> 단계
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-neutral-400">생년월일을 입력하면 월령에 맞춰 추천이 조정돼요.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          끼니별 목표량 (±{MEAL_TARGET_TOLERANCE}g)
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {mealTypes.map((mt) => (
            <label key={mt} className="flex flex-col gap-1 text-xs text-neutral-500">
              {mt}
              <input
                type="number"
                min={0}
                value={profile.mealTargetGrams[mt] ?? ''}
                placeholder="미설정"
                onChange={(e) => {
                  const v = e.target.value
                  update({
                    mealTargetGrams: {
                      ...profile.mealTargetGrams,
                      [mt]: v === '' ? undefined : Number(v),
                    },
                  })
                }}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              />
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-neutral-400">
          비워두면 월령 기본값으로 추천해요. 입력하면 해당 끼니 총량을 목표치 ±{MEAL_TARGET_TOLERANCE}g에 맞춰 구성해요.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">알레르기 재료</h2>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {profile.allergyIngredientIds.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {ingredientById.get(id)?.name ?? '(삭제된 재료)'}
              <button onClick={() => removeFromList('allergyIngredientIds', id)}>✕</button>
            </span>
          ))}
          {profile.allergyIngredientIds.length === 0 && (
            <span className="text-xs text-neutral-400">등록된 알레르기 재료 없음</span>
          )}
        </div>
        <SearchSelect
          options={(ingredients ?? [])
            .filter((i) => !profile.allergyIngredientIds.includes(i.id!))
            .map((i) => ({ id: i.id!, label: i.name, sublabel: i.category }))}
          value={0}
          placeholder="+ 알레르기 재료 추가"
          onChange={(id) => addToList('allergyIngredientIds', id)}
        />
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">기피 재료</h2>
        <p className="mb-2 text-xs text-neutral-400">알레르기는 아니지만 추천에서 제외하고 싶은 재료예요.</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {profile.avoidIngredientIds.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
            >
              {ingredientById.get(id)?.name ?? '(삭제된 재료)'}
              <button onClick={() => removeFromList('avoidIngredientIds', id)}>✕</button>
            </span>
          ))}
          {profile.avoidIngredientIds.length === 0 && (
            <span className="text-xs text-neutral-400">등록된 기피 재료 없음</span>
          )}
        </div>
        <SearchSelect
          options={(ingredients ?? [])
            .filter((i) => !profile.avoidIngredientIds.includes(i.id!))
            .map((i) => ({ id: i.id!, label: i.name, sublabel: i.category }))}
          value={0}
          placeholder="+ 기피 재료 추가"
          onChange={(id) => addToList('avoidIngredientIds', id)}
        />
      </section>

      {guide && (
        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {months}개월 영양 가이드
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">{guide.feedingGuide}</p>
          {guide.ironNote && (
            <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">⚠ {guide.ironNote}</p>
          )}
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-500">
            에너지 적정비율(한국인 영양소 섭취기준 2025): 탄수화물 50~65% · 단백질 10~20% · 지방 15~30%
          </p>
          <p className="mt-2 text-[11px] text-neutral-400">
            일반적인 가이드라인이며, 아기 상태에 따라 다를 수 있어요. 정확한 영양 계획은 소아과 전문의와 상담하세요.
          </p>
        </section>
      )}
    </div>
  )
}
