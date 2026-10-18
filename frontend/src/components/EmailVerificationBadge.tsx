import { FC } from 'react'
import { EmailVerificationStatus } from '../api/types/leads/getMany'

type Props = {
  status: EmailVerificationStatus | null
  onRetry: () => void
  isRetrying?: boolean
}

const badgeClassName = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'

export const EmailVerificationBadge: FC<Props> = ({ status, onRetry, isRetrying = false }) => {
  switch (status) {
    case 'PENDING':
      return (
        <span className={`${badgeClassName} bg-blue-50 text-blue-700`}>
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
          Verifying…
        </span>
      )
    case 'VERIFIED':
      return (
        <span className={`${badgeClassName} bg-green-50 text-emerald-700`} title="Email verified">
          ✓ Verified
        </span>
      )
    case 'INVALID':
      return (
        <span className={`${badgeClassName} bg-red-50 text-red-700`} title="Email is not deliverable">
          ✗ Invalid
        </span>
      )
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1">
          <span
            className={`${badgeClassName} bg-amber-50 text-amber-700`}
            title="The verification provider did not answer"
          >
            Couldn't verify
          </span>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retry
          </button>
        </span>
      )
    default:
      return (
        <span className={`${badgeClassName} bg-gray-100 text-gray-500`} title="Email not verified yet">
          Unverified
        </span>
      )
  }
}
