import { FC } from 'react'
import { Lead, PhoneProviderId } from '../api/types/leads/getMany'

export const PHONE_PROVIDER_LABELS: Record<PhoneProviderId, string> = {
  orionConnect: 'Orion Connect',
  astraDialer: 'Astra Dialer',
  nimbusLookup: 'Nimbus Lookup',
}

type Props = {
  lead: Pick<Lead, 'phoneNumber' | 'phoneEnrichmentStatus' | 'phoneEnrichmentProvider'>
  onRetry: () => void
  isRetrying?: boolean
}

const badgeClassName = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'

const RetryButton: FC<{ onClick: () => void; disabled: boolean }> = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Retry
  </button>
)

/** Phone number plus live enrichment feedback (which provider is being queried, outcome, retry). */
export const PhoneCell: FC<Props> = ({ lead, onRetry, isRetrying = false }) => {
  const { phoneNumber, phoneEnrichmentStatus: status, phoneEnrichmentProvider: provider } = lead
  const providerLabel = provider ? PHONE_PROVIDER_LABELS[provider] : null

  if (status === 'PENDING') {
    return (
      <span className={`${badgeClassName} bg-blue-50 text-blue-700`} role="status">
        <svg
          className="animate-spin h-3 w-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        {providerLabel ? `Searching · ${providerLabel}` : 'Searching…'}
      </span>
    )
  }

  if (phoneNumber) {
    return (
      <span
        className="text-sm text-gray-900"
        title={status === 'FOUND' && providerLabel ? `Found by ${providerLabel}` : undefined}
      >
        {phoneNumber}
        {status === 'FOUND' && <span className="ml-1 text-xs text-gray-400">· enriched</span>}
      </span>
    )
  }

  if (status === 'NOT_FOUND') {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className={`${badgeClassName} bg-gray-100 text-gray-600`}
          title="No provider had a phone for this lead"
        >
          No data found
        </span>
        <RetryButton onClick={onRetry} disabled={isRetrying} />
      </span>
    )
  }

  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className={`${badgeClassName} bg-amber-50 text-amber-700`}
          title="A provider kept failing; retrying may still find a phone"
        >
          Couldn't complete
        </span>
        <RetryButton onClick={onRetry} disabled={isRetrying} />
      </span>
    )
  }

  return <span className="text-sm text-gray-900">-</span>
}
