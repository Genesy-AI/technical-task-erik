import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { FC, useMemo } from 'react'
import { PreviewLead, renderTemplatePreview } from '../../utils/messageTemplate'

interface TemplatePreviewProps {
  template: string
  lead: PreviewLead | undefined
  leadName: string | undefined
  knownKeys: ReadonlySet<string> | undefined
  position: number
  total: number
  onPrevious: () => void
  onNext: () => void
}

const uniqueKeys = (keys: string[]) => Array.from(new Set(keys))

/** Live preview of the template rendered against one of the selected leads. */
export const TemplatePreview: FC<TemplatePreviewProps> = ({
  template,
  lead,
  leadName,
  knownKeys,
  position,
  total,
  onPrevious,
  onNext,
}) => {
  const segments = useMemo(
    () => renderTemplatePreview(template, lead, knownKeys),
    [template, lead, knownKeys]
  )
  const unknownKeys = uniqueKeys(
    segments.flatMap((segment) => (segment.type === 'unknown' ? [segment.key] : []))
  )
  const missingKeys = uniqueKeys(
    segments.flatMap((segment) => (segment.type === 'missing' ? [segment.key] : []))
  )

  return (
    <section aria-label="Message preview" className="border border-gray-200 rounded-md">
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-md">
        <span className="text-sm font-medium text-gray-700 truncate">
          Preview{leadName ? ` for ${leadName}` : ''}
        </span>
        {total > 1 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Previous lead"
              className="p-1 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <IconChevronLeft size={14} aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {position} of {total}
            </span>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next lead"
              className="p-1 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <IconChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="px-3 py-2 min-h-16 max-h-48 overflow-y-auto text-sm text-gray-900 whitespace-pre-wrap break-words">
        {!lead ? (
          <span className="text-gray-400">Lead data isn't available for preview.</span>
        ) : !template ? (
          <span className="text-gray-400">Start typing to see a preview.</span>
        ) : (
          segments.map((segment, index) => {
            switch (segment.type) {
              case 'text':
                return <span key={index}>{segment.text}</span>
              case 'value':
                return (
                  <span
                    key={index}
                    className="bg-blue-50 text-blue-900 rounded px-0.5"
                    title={`{${segment.key}}`}
                  >
                    {segment.text}
                  </span>
                )
              case 'missing':
                return (
                  <mark
                    key={index}
                    className="bg-amber-100 text-amber-800 rounded px-0.5"
                    title="This lead has no value for this field"
                  >
                    {segment.text}
                  </mark>
                )
              case 'unknown':
                return (
                  <mark key={index} className="bg-red-100 text-red-700 rounded px-0.5" title="Unknown field">
                    {segment.text}
                  </mark>
                )
            }
          })
        )}
      </div>

      {lead && (unknownKeys.length > 0 || missingKeys.length > 0) && (
        <div className="px-3 py-2 space-y-1 text-xs border-t border-gray-200">
          {unknownKeys.length > 0 && (
            <p className="text-red-700">
              Unknown field{unknownKeys.length !== 1 ? 's' : ''}:{' '}
              {unknownKeys.map((key) => `{${key}}`).join(', ')}. No messages will be generated until{' '}
              {unknownKeys.length !== 1 ? 'they are' : 'it is'} fixed.
            </p>
          )}
          {missingKeys.length > 0 && (
            <p className="text-amber-700">
              Missing on this lead: {missingKeys.map((key) => `{${key}}`).join(', ')}. No message will be
              generated for this lead.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
