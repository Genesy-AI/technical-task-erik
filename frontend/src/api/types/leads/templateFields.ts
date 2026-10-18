export type LeadsTemplateFieldsInput = undefined

export type TemplateFieldGroup = 'Contact' | 'Company' | 'Social'

export type TemplateField = {
  key: string
  label: string
  group: TemplateFieldGroup
  example?: string
}

export type LeadsTemplateFieldsOutput = TemplateField[]
