import { describe, it, expect } from 'vitest'
import { parseCsv, isValidEmail } from './csvParser'

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all required fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
John,Doe,john.doe@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      isValid: true,
      errors: [],
      warnings: [],
      rowIndex: 2,
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email
,Smith,john@example.com
John,,john@example.com
John,Smith,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email
John,Doe,invalid-email
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,jobTitle
"John","Doe","john.doe@example.com","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,,
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode
John,Doe,john@example.com,,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com
Bob,Johnson,bob@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email
 , ,invalid-email`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toHaveLength(3)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,unknownColumn
John,Doe,john@example.com,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,Smith,invalid-email
Jane,Johnson,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email
 John , Doe , john@example.com `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  describe('country code validation', () => {
    // Normalization rules (case, aliases, accepted codes) are tested in countryCodes.test.ts;
    // here we only check how the parser uses the result.
    it('should store the normalized country code without warnings', () => {
      const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com, es `

      const result = parseCsv(csv)

      expect(result[0].countryCode).toBe('ES')
      expect(result[0].warnings).toEqual([])
    })

    it('should drop invalid country codes with a warning without invalidating the row', () => {
      const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com,XXX
Jane,Smith,jane@example.com,12
Bob,Stone,bob@example.com,XX`

      const result = parseCsv(csv)

      result.forEach((lead) => {
        expect(lead.isValid).toBe(true)
        expect(lead.errors).toEqual([])
        expect(lead.countryCode).toBeUndefined()
        expect(lead.warnings).toHaveLength(1)
      })
      expect(result[0].warnings[0]).toContain('Invalid country code "XXX"')
      expect(result[1].warnings[0]).toContain('Invalid country code "12"')
    })

    it('should not warn when the country code is empty', () => {
      const csv = `firstName,lastName,email,countryCode
John,Doe,john@example.com,`

      const result = parseCsv(csv)

      expect(result[0].countryCode).toBeUndefined()
      expect(result[0].warnings).toEqual([])
    })

    it('should keep errors and warnings separate', () => {
      const csv = `firstName,lastName,email,countryCode
John,,john@example.com,XXX`

      const result = parseCsv(csv)

      expect(result[0].isValid).toBe(false)
      expect(result[0].errors).toEqual(['Last name is required'])
      expect(result[0].warnings).toHaveLength(1)
    })

    it('should import rows from the sample error file without their invalid country codes', () => {
      // Excerpt of docs/leads-with-errors.csv
      const csv = `firstName,lastName,email,jobTitle,countryCode,companyName,yearsInRole,phoneNumber
Iñaki,Álvarez,rodriguezbrian@smith.net,Restaurant manager,ES,Rogers Inc,10,+1-648-901-1274x3620
Gabrielle,,uharrington@austin.com,Secretary/administrator,XXX,Ray LLC,15,
Amanda,James,kevin03@beard.net,"Research officer, trade union",12,Page-Bond,15,+1-076-096-4074x6140
Latasha,Martin,aprilmcconnell@gmail.com,Diagnostic radiographer,XXX,Bates Inc,10,`

      const result = parseCsv(csv)

      expect(result.map((lead) => lead.countryCode)).toEqual(['ES', undefined, undefined, undefined])
      expect(result.map((lead) => lead.warnings.length)).toEqual([0, 1, 1, 1])
      // Gabrielle is invalid because of the missing last name, not because of the country code
      expect(result.map((lead) => lead.isValid)).toEqual([true, false, true, true])
    })
  })

  describe('phone, years at company, LinkedIn and company website', () => {
    it('should parse the sample CSV columns (yearsInRole maps to yearsAtCompany)', () => {
      const csv = `firstName,lastName,email,jobTitle,countryCode,companyName,yearsInRole,phoneNumber
Chad,Smith,hancockjames@gmail.com,Child psychotherapist,TV,Global Tech Solutions,2,+1-280-754-0462x2154`

      const result = parseCsv(csv)

      expect(result[0]).toMatchObject({
        yearsAtCompany: 2,
        phoneNumber: '+1-280-754-0462x2154',
        isValid: true,
        warnings: [],
      })
    })

    it.each([
      ['phoneNumber', 'yearsAtCompany', 'linkedinUrl', 'companyWebsite'],
      ['Phone', 'Years In Company', 'LinkedIn', 'Website'],
      ['phone_number', 'years_at_company', 'linkedin_profile', 'company_domain'],
      ['PHONE', 'yearsInRole', 'LINKEDIN URL', 'Company Website'],
    ])('should accept header spellings %s, %s, %s, %s', (phone, years, linkedin, website) => {
      const csv = `firstName,lastName,email,${phone},${years},${linkedin},${website}
Ada,Lovelace,ada@example.com,(731)123-9702,0,linkedin.com/in/ada,https://www.Example.com/about`

      const result = parseCsv(csv)

      expect(result[0]).toMatchObject({
        phoneNumber: '(731)123-9702',
        yearsAtCompany: 0,
        linkedinUrl: 'https://linkedin.com/in/ada',
        companyWebsite: 'example.com',
        isValid: true,
        warnings: [],
      })
    })

    it('should drop invalid values with warnings without invalidating the row', () => {
      const csv = `firstName,lastName,email,phoneNumber,yearsAtCompany,linkedinUrl,companyWebsite
Ada,Lovelace,ada@example.com,call me,-2,https://example.com/in/ada,Acme Inc`

      const result = parseCsv(csv)

      expect(result[0].isValid).toBe(true)
      expect(result[0].errors).toEqual([])
      expect(result[0].phoneNumber).toBeUndefined()
      expect(result[0].yearsAtCompany).toBeUndefined()
      expect(result[0].linkedinUrl).toBeUndefined()
      expect(result[0].companyWebsite).toBeUndefined()
      expect(result[0].warnings).toEqual([
        'Invalid phone number "call me"',
        'Invalid years at company "-2" (expected a number from 0 to 80)',
        'Invalid LinkedIn URL "https://example.com/in/ada" (expected a linkedin.com URL)',
        'Invalid company website "Acme Inc"',
      ])
    })

    it('should reject out of range years', () => {
      const csv = `firstName,lastName,email,yearsAtCompany
Ada,Lovelace,ada@example.com,81`

      const result = parseCsv(csv)

      expect(result[0].yearsAtCompany).toBeUndefined()
      expect(result[0].warnings).toEqual(['Invalid years at company "81" (expected a number from 0 to 80)'])
    })

    it('should round fractional years down with a warning', () => {
      const csv = `firstName,lastName,email,yearsAtCompany
Ada,Lovelace,ada@example.com,2.5
Bob,Stone,bob@example.com,3.0`

      const result = parseCsv(csv)

      expect(result.map((lead) => lead.yearsAtCompany)).toEqual([2, 3])
      expect(result[0].warnings).toEqual(['Years at company "2.5" rounded down to 2 (whole years only)'])
      // "3.0" is already a whole number, so nothing was lost
      expect(result[1].warnings).toEqual([])
    })

    it('should leave empty optional values undefined without warnings', () => {
      const csv = `firstName,lastName,email,phoneNumber,yearsAtCompany,linkedinUrl,companyWebsite
Ada,Lovelace,ada@example.com,,,,`

      const result = parseCsv(csv)

      expect(result[0].warnings).toEqual([])
      expect(result[0].yearsAtCompany).toBeUndefined()
    })
  })
})
