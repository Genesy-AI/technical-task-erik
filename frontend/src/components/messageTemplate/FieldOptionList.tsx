import { FC, useEffect, useRef } from 'react'
import type { TemplateField } from '../../api/types/leads/templateFields'
import { fieldOptionId, groupTemplateFields } from '../../utils/messageTemplate'

interface FieldOptionListProps {
  id: string
  label: string
  /** Fields in display (grouped) order, see orderFieldsByGroup. */
  fields: TemplateField[]
  activeKey: string | undefined
  onSelect: (field: TemplateField) => void
  onActiveChange: (index: number) => void
  className?: string
}

/**
 * Grouped listbox of template fields. Focus stays on the controlling input (combobox pattern with
 * aria-activedescendant), so options don't take focus on click.
 */
export const FieldOptionList: FC<FieldOptionListProps> = ({
  id,
  label,
  fields,
  activeKey,
  onSelect,
  onActiveChange,
  className = '',
}) => {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeKey) return
    const option = document.getElementById(fieldOptionId(id, activeKey))
    if (option && listRef.current?.contains(option)) option.scrollIntoView?.({ block: 'nearest' })
  }, [activeKey, id])

  let flatIndex = -1
  return (
    <div ref={listRef} id={id} role="listbox" aria-label={label} className={`overflow-y-auto ${className}`}>
      {groupTemplateFields(fields).map(({ group, fields: groupFields }) => (
        <div key={group} role="group" aria-labelledby={`${id}-group-${group}`}>
          <div
            id={`${id}-group-${group}`}
            className="px-3 pt-2 pb-1 text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            {group}
          </div>
          {groupFields.map((field) => {
            flatIndex++
            const index = flatIndex
            const isActive = field.key === activeKey
            return (
              <div
                key={field.key}
                id={fieldOptionId(id, field.key)}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => !isActive && onActiveChange(index)}
                onClick={() => onSelect(field)}
                className={`flex items-center justify-between gap-3 px-3 py-1.5 text-sm cursor-pointer ${
                  isActive ? 'bg-blue-50 text-blue-900' : 'text-gray-700'
                }`}
              >
                <span>{field.label}</span>
                <code className="text-xs text-blue-800 bg-blue-100 rounded px-1.5 py-0.5">{`{${field.key}}`}</code>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
