import { IconExternalLink } from '@tabler/icons-react'
import { FC, ReactNode } from 'react'

interface ExternalLinkProps {
  href: string
  title?: string
  children: ReactNode
}

const isHttpUrl = (href: string) => /^https?:\/\//i.test(href)

/** Opens in a new tab; non-http(s) URLs (e.g. `javascript:`) are rendered as plain text. */
export const ExternalLink: FC<ExternalLinkProps> = ({ href, title, children }) => {
  if (!isHttpUrl(href)) return <span title={title}>{children}</span>

  return (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
    >
      {children}
      <IconExternalLink size={14} aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}
