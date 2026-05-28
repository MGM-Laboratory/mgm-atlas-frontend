/**
 * Compute a new `positionInStatus` for a task being inserted into a
 * sorted column. The convention everywhere on the frontend + backend
 * is a positive real number with smaller meaning earlier in the column.
 *
 *   insertBetween(prev=undefined, next=2)   → 1   (head of column)
 *   insertBetween(prev=2, next=5)           → 3.5 (between two items)
 *   insertBetween(prev=5, next=undefined)   → 6   (tail of column)
 *   insertBetween(undefined, undefined)     → 1   (empty column)
 *
 * Backend column is Decimal(20,10) so we have 10 digits of fractional
 * precision before positions get truncated. That's plenty for typical
 * usage; if it ever becomes a problem, Phase 11 polish can add a
 * rebalance pass that renumbers the column to integers.
 */
export function computePosition(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return 1;
  if (prev === undefined && next !== undefined) {
    // First slot — half the next position, but never zero.
    return next > 0 ? next / 2 : 1;
  }
  if (prev !== undefined && next === undefined) {
    return prev + 1;
  }
  // Both defined → midpoint.
  return (prev! + next!) / 2;
}
