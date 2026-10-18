import { useEffect, useState } from 'react'

/** Keyboard "active option" state for listboxes: wraps around and resets when the items change. */
export const useListNavigation = <T>(items: readonly T[]) => {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [items])

  const count = items.length
  return {
    activeIndex: count > 0 ? Math.min(activeIndex, count - 1) : -1,
    activeItem: count > 0 ? items[Math.min(activeIndex, count - 1)] : undefined,
    setActiveIndex,
    moveNext: () => setActiveIndex((index) => (count > 0 ? (index + 1) % count : 0)),
    movePrevious: () => setActiveIndex((index) => (count > 0 ? (index - 1 + count) % count : 0)),
  }
}
