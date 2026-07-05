import dayjs from 'dayjs'
import type { Stage } from './types'

export function ageInMonths(birthDate: string | undefined, at: dayjs.Dayjs = dayjs()): number | null {
  if (!birthDate) return null
  const parsed = dayjs(birthDate)
  if (!parsed.isValid()) return null
  return at.diff(parsed, 'month')
}

export function stageForAgeMonths(months: number): Stage {
  if (months < 7) return '초기'
  if (months < 9) return '중기'
  if (months < 12) return '후기'
  return '완료기'
}

export const DEFAULT_STAGE: Stage = '중기'

export function resolveStage(birthDate: string | undefined, at?: dayjs.Dayjs): Stage {
  const months = ageInMonths(birthDate, at)
  return months == null ? DEFAULT_STAGE : stageForAgeMonths(months)
}

interface AgeGuideline {
  stageLabel: string
  feedingGuide: string
  ironNote?: string
}

/**
 * Reference guidance summarized from Korean Dietary Reference Intakes (KDRI) 2025
 * (carb 50-65% / protein 10-20% / fat 15-30% of energy) and standard 이유식 stage
 * portioning guides. General guidance only — not individualized medical advice.
 */
export function ageGuideline(months: number): AgeGuideline {
  const stage = stageForAgeMonths(months)
  const feedingGuideByStage: Record<Stage, string> = {
    초기: '하루 1회, 1회 5~20g (총 30~80g). 곱게 갈아 부드러운 미음/퓨레 형태로.',
    중기: '하루 2~3회, 1회 30~50g (하루 총 100~150g). 무른 죽 형태, 알갱이 조금씩 시작.',
    후기: '하루 3회, 1회 30~50g (하루 총 100~150g). 0.5cm 크기 덩어리, 씹는 연습.',
    완료기: '하루 3회+간식 1~2회, 1회 100~200g. 진밥/일반식에 가까운 형태.',
  }
  const ironNote =
    months >= 9 && months <= 24
      ? '생후 9~24개월은 철결핍성 빈혈 위험이 가장 높은 시기예요. 철분 강화 곡물, 소고기·닭고기 같은 헴철 식품을 우선 추천해요.'
      : undefined

  return { stageLabel: stage, feedingGuide: feedingGuideByStage[stage], ironNote }
}
