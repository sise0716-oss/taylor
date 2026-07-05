import Dexie, { type EntityTable } from 'dexie'
import type {
  BabyProfile,
  Feedback,
  Ingredient,
  InventoryItem,
  Meal,
  MealItem,
} from './types'

export class MammaDB extends Dexie {
  ingredients!: EntityTable<Ingredient, 'id'>
  inventory!: EntityTable<InventoryItem, 'id'>
  meals!: EntityTable<Meal, 'id'>
  mealItems!: EntityTable<MealItem, 'id'>
  feedback!: EntityTable<Feedback, 'id'>
  profile!: EntityTable<BabyProfile, 'id'>

  constructor() {
    super('aga-bap')
    this.version(1).stores({
      ingredients: '++id, name, category',
      inventory: '++id, ingredientId, expirationDate',
      meals: '++id, date, status, [date+mealType]',
      mealItems: '++id, mealId, ingredientId',
      feedback: '++id, mealId',
      profile: '++id',
    })
  }
}

export const db = new MammaDB()
