/** `null` means the email has never been verified. */
export type EmailVerificationStatus = 'PENDING' | 'VERIFIED' | 'INVALID' | 'FAILED'

export type LeadsGetManyInput = undefined

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  message: string | null
  emailVerificationStatus: EmailVerificationStatus | null
}[]

export type Lead = LeadsGetManyOutput[number]
