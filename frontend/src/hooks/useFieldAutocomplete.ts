import { KeyboardEvent, RefObject, useMemo, useState } from 'react'
import type { TemplateField } from '../api/types/leads/templateFields'
import {
  completePartialToken,
  fieldOptionId,
  filterTemplateFields,
  findPartialToken,
  orderFieldsByGroup,
  PartialToken,
} from '../utils/messageTemplate'
import { useListNavigation } from './useListNavigation'

interface UseFieldAutocompleteOptions {
  listId: string
  textareaRef: RefObject<HTMLTextAreaElement>
  template: string
  onTemplateChange: (template: string, caret: number) => void
  fields: TemplateField[] | undefined
}

/**
 * Autocomplete for `{field}` placeholders while typing in a textarea: typing `{` opens suggestions filtered by
 * the characters typed after it; Enter/Tab inserts the active suggestion, Escape dismisses.
 */
export const useFieldAutocomplete = ({
  listId,
  textareaRef,
  template,
  onTemplateChange,
  fields,
}: UseFieldAutocompleteOptions) => {
  const [token, setToken] = useState<PartialToken | null>(null)
  // Start index of a token dismissed with Escape; it stays closed until the caret leaves that token
  const [dismissedStart, setDismissedStart] = useState<number | null>(null)

  const suggestions = useMemo(
    () => (token ? orderFieldsByGroup(filterTemplateFields(fields ?? [], token.query)) : []),
    [fields, token]
  )
  const navigation = useListNavigation(suggestions)
  const isOpen = !!token && token.start !== dismissedStart && suggestions.length > 0

  /** Re-detects the token at the caret; call on every caret/text change. */
  const syncWithCaret = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    const caret = textarea.selectionStart
    const hasSelection = caret !== textarea.selectionEnd
    const nextToken = hasSelection ? null : findPartialToken(textarea.value, caret)
    setToken((previous) =>
      previous?.start === nextToken?.start && previous?.query === nextToken?.query ? previous : nextToken
    )
    if (!nextToken || nextToken.start !== dismissedStart) setDismissedStart(null)
  }

  const accept = (field: TemplateField) => {
    const textarea = textareaRef.current
    if (!token || !textarea) return
    const result = completePartialToken(template, token.start, textarea.selectionStart, field.key)
    setToken(null)
    onTemplateChange(result.text, result.caret)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        navigation.moveNext()
        break
      case 'ArrowUp':
        e.preventDefault()
        navigation.movePrevious()
        break
      case 'Enter':
      case 'Tab':
        if (navigation.activeItem) {
          e.preventDefault()
          accept(navigation.activeItem)
        }
        break
      case 'Escape':
        // Dismiss the suggestions only, not the modal
        e.preventDefault()
        e.stopPropagation()
        setDismissedStart(token!.start)
        break
    }
  }

  return {
    isOpen,
    query: token?.query ?? '',
    suggestions,
    activeKey: navigation.activeItem?.key,
    setActiveIndex: navigation.setActiveIndex,
    accept,
    close: () => setToken(null),
    textareaProps: {
      onKeyDown: handleKeyDown,
      onSelect: syncWithCaret,
      onBlur: () => setToken(null),
      'aria-autocomplete': 'list' as const,
      // A textarea can't take role="combobox" (so no aria-expanded); it keeps its textbox role, which
      // supports aria-autocomplete/aria-controls/aria-activedescendant.
      'aria-controls': isOpen ? listId : undefined,
      'aria-activedescendant':
        isOpen && navigation.activeItem ? fieldOptionId(listId, navigation.activeItem.key) : undefined,
    },
  }
}
