import { db } from './db'

export async function deductInventory(ingredientId: number, quantity: number) {
  let remaining = quantity
  const batches = await db.inventory
    .where('ingredientId')
    .equals(ingredientId)
    .and((item) => item.quantity > 0)
    .sortBy('expirationDate')

  for (const batch of batches) {
    if (remaining <= 0) break
    const used = Math.min(batch.quantity, remaining)
    remaining -= used
    await db.inventory.update(batch.id!, { quantity: batch.quantity - used })
  }
}

export async function availableQuantity(ingredientId: number): Promise<number> {
  const batches = await db.inventory.where('ingredientId').equals(ingredientId).toArray()
  return batches.reduce((sum, b) => sum + Math.max(0, b.quantity), 0)
}
