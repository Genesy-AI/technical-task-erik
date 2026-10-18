import type { TemplateField } from '../api/types/leads/templateFields'

/**
 * Pure helpers for the message template composer. Placeholder syntax and value semantics mirror
 * backend/src/utils/messageGenerator.ts: `{fieldName}` with word characters only, and null/undefined/''
 * values count as missing (0 is a valid value).
 */

const TEMPLATE_VARIABLE_REGEX = /\{(\w+)\}/g

export interface FieldGroup {
  group: string
  fields: TemplateField[]
}

/** Groups fields preserving the registry order of both groups and fields. */
export const groupTemplateFields = (fields: TemplateField[]): FieldGroup[] => {
  const groups = new Map<string, TemplateField[]>()
  for (const field of fields) {
    const groupFields = groups.get(field.group) ?? []
    groupFields.push(field)
    groups.set(field.group, groupFields)
  }
  return Array.from(groups, ([group, groupFields]) => ({ group, fields: groupFields }))
}

/** Flattens fields in the order they're displayed (by group), which is also the keyboard navigation order. */
export const orderFieldsByGroup = (fields: TemplateField[]): TemplateField[] =>
  groupTemplateFields(fields).flatMap((group) => group.fields)

/** DOM id of a field option inside a listbox, used for aria-activedescendant. */
export const fieldOptionId = (listId: string, key: string) => `${listId}-option-${key}`

/**
 * Case-insensitive search on key and label. Fields whose key or label starts with the query rank first;
 * within each tier the registry order is kept so grouping stays stable.
 */
export const filterTemplateFields = (fields: TemplateField[], query: string): TemplateField[] => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return fields

  const prefixMatches: TemplateField[] = []
  const otherMatches: TemplateField[] = []
  for (const field of fields) {
    const key = field.key.toLowerCase()
    const label = field.label.toLowerCase()
    const labelWords = label.split(/\s+/)
    if (key.startsWith(normalizedQuery) || labelWords.some((word) => word.startsWith(normalizedQuery))) {
      prefixMatches.push(field)
    } else if (key.includes(normalizedQuery) || label.includes(normalizedQuery)) {
      otherMatches.push(field)
    }
  }
  return [...prefixMatches, ...otherMatches]
}

export interface PartialToken {
  /** Index of the opening `{`. */
  start: number
  /** Characters typed after `{` up to the caret. */
  query: string
}

/**
 * Detects a placeholder being typed: an opening `{` followed only by word characters up to the caret
 * (e.g. "Hi {fir|"). Returns null when the caret isn't inside an unfinished placeholder.
 */
export const findPartialToken = (text: string, caret: number): PartialToken | null => {
  let index = caret - 1
  while (index >= 0 && /\w/.test(text[index])) index--
  if (index < 0 || text[index] !== '{') return null
  return { start: index, query: text.slice(index + 1, caret) }
}

/**
 * Replaces the partial token starting at `start` (plus any word characters and a closing `}` right after the
 * caret) with `{key}`. Returns the new text and the caret position right after the inserted placeholder.
 */
export const completePartialToken = (
  text: string,
  start: number,
  caret: number,
  key: string
): { text: string; caret: number } => {
  let end = caret
  while (end < text.length && /\w/.test(text[end])) end++
  if (text[end] === '}') end++
  const placeholder = `{${key}}`
  return { text: text.slice(0, start) + placeholder + text.slice(end), caret: start + placeholder.length }
}

/** Inserts `{key}` replacing the current selection. */
export const insertPlaceholder = (
  text: string,
  selectionStart: number,
  selectionEnd: number,
  key: string
): { text: string; caret: number } => {
  const placeholder = `{${key}}`
  return {
    text: text.slice(0, selectionStart) + placeholder + text.slice(selectionEnd),
    caret: selectionStart + placeholder.length,
  }
}

export type PreviewSegment =
  | { type: 'text'; text: string }
  | { type: 'value'; key: string; text: string }
  | { type: 'missing'; key: string; text: string }
  | { type: 'unknown'; key: string; text: string }

export type PreviewLead = Record<string, unknown>

/**
 * Splits a template into segments for the live preview, resolving placeholders against `lead`.
 * When `knownKeys` isn't available yet (fields still loading), placeholders are never flagged as unknown.
 */
export const renderTemplatePreview = (
  template: string,
  lead: PreviewLead | undefined,
  knownKeys?: ReadonlySet<string>
): PreviewSegment[] => {
  const segments: PreviewSegment[] = []
  let lastIndex = 0

  for (const match of template.matchAll(TEMPLATE_VARIABLE_REGEX)) {
    const [placeholder, key] = match
    const index = match.index ?? 0
    if (index > lastIndex) segments.push({ type: 'text', text: template.slice(lastIndex, index) })

    const value = lead?.[key]
    if (knownKeys && !knownKeys.has(key)) {
      segments.push({ type: 'unknown', key, text: placeholder })
    } else if (value === null || value === undefined || value === '') {
      segments.push({ type: 'missing', key, text: placeholder })
    } else {
      segments.push({ type: 'value', key, text: String(value) })
    }
    lastIndex = index + placeholder.length
  }

  if (lastIndex < template.length) segments.push({ type: 'text', text: template.slice(lastIndex) })
  return segments
}
