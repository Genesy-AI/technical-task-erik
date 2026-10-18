import { IconBraces, IconChevronDown, IconSearch } from '@tabler/icons-react'
import { FC, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { TemplateField } from '../../api/types/leads/templateFields'
import { useListNavigation } from '../../hooks/useListNavigation'
import { fieldOptionId, filterTemplateFields, orderFieldsByGroup } from '../../utils/messageTemplate'
import { FieldOptionList } from './FieldOptionList'

interface FieldPickerProps {
  fields: TemplateField[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onInsert: (field: TemplateField) => void
}

/** "Insert field" button opening a searchable, grouped list of template fields. */
export const FieldPicker: FC<FieldPickerProps> = ({ fields, isLoading, isError, onRetry, onInsert }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const visibleFields = useMemo(
    () => orderFieldsByGroup(filterTemplateFields(fields ?? [], query)),
    [fields, query]
  )
  const { activeIndex, activeItem, setActiveIndex, moveNext, movePrevious } = useListNavigation(visibleFields)

  const close = ({ restoreFocus }: { restoreFocus: boolean }) => {
    setIsOpen(false)
    setQuery('')
    if (restoreFocus) buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  const select = (field: TemplateField) => {
    close({ restoreFocus: false })
    onInsert(field)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveNext()
        break
      case 'ArrowUp':
        e.preventDefault()
        movePrevious()
        break
      case 'Enter':
        // Never submit the surrounding form from the search box
        e.preventDefault()
        if (activeItem) select(activeItem)
        break
      case 'Escape':
        // Close only the popover, not the modal
        e.preventDefault()
        e.stopPropagation()
        close({ restoreFocus: true })
        break
      case 'Tab':
        close({ restoreFocus: false })
        break
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close({ restoreFocus: false }) : setIsOpen(true))}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-blue-800 bg-blue-100 rounded hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        <IconBraces size={16} aria-hidden="true" />
        Insert field
        <IconChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-20 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="relative p-2 border-b border-gray-200">
            <IconSearch
              size={16}
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              role="combobox"
              aria-label="Search fields"
              aria-autocomplete="list"
              aria-expanded={visibleFields.length > 0}
              aria-controls={listId}
              aria-activedescendant={activeItem ? fieldOptionId(listId, activeItem.key) : undefined}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search fields..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {isLoading ? (
            <p className="px-3 py-3 text-sm text-gray-500">Loading fields...</p>
          ) : isError ? (
            <div className="px-3 py-3 text-sm text-red-600">
              Couldn't load fields.{' '}
              <button type="button" onClick={onRetry} className="font-medium underline hover:text-red-800">
                Retry
              </button>
            </div>
          ) : visibleFields.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">No fields match "{query}"</p>
          ) : (
            <FieldOptionList
              id={listId}
              label="Template fields"
              fields={visibleFields}
              activeKey={activeIndex >= 0 ? activeItem?.key : undefined}
              onSelect={select}
              onActiveChange={setActiveIndex}
              className="max-h-64 pb-1"
            />
          )}
        </div>
      )}
    </div>
  )
}
