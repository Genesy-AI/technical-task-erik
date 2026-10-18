import express, { Request, Response } from 'express'
import { config } from './config'
import { prisma } from './db'
import { streamLeadEvents } from './events/leadEventsSse'
import { startEmailVerification } from './leads/startEmailVerification'
import { startPhoneEnrichment } from './leads/startPhoneEnrichment'
import { findUnknownTemplateFields, generateMessageFromTemplate } from './utils/messageGenerator'
import { hasRequiredLeadFields, sanitizeImportedLead } from './utils/leadImport'
import { TEMPLATE_FIELDS } from './utils/templateFields'
import { runTemporalWorker } from './worker'
const app = express()
app.use(express.json())

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }

  next()
})

app.post('/leads', async (req: Request, res: Response) => {
  const { name, lastName, email } = req.body

  if (!name || !lastName || !email) {
    return res.status(400).json({ error: 'firstName, lastName, and email are required' })
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: String(name),
      lastName: String(lastName),
      email: String(email),
    },
  })
  res.json(lead)
})

// Must be registered before `/leads/:id`.
app.get('/leads/events', streamLeadEvents)

// Registered before `/leads/:id` so "template-fields" isn't captured as an id
app.get('/leads/template-fields', (req: Request, res: Response) => {
  res.json(TEMPLATE_FIELDS)
})

app.get('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const lead = await prisma.lead.findUnique({
    where: {
      id: Number(id),
    },
  })
  res.json(lead)
})

app.get('/leads', async (req: Request, res: Response) => {
  const leads = await prisma.lead.findMany()

  res.json(leads)
})

app.patch('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, email } = req.body
  const lead = await prisma.lead.update({
    where: {
      id: Number(id),
    },
    data: {
      firstName: String(name),
      email: String(email),
    },
  })
  res.json(lead)
})

app.delete('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  await prisma.lead.delete({
    where: {
      id: Number(id),
    },
  })
  res.json()
})

app.delete('/leads', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { ids } = req.body

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  }

  try {
    const result = await prisma.lead.deleteMany({
      where: {
        id: {
          in: ids.map((id) => Number(id)),
        },
      },
    })

    res.json({ deletedCount: result.count })
  } catch (error) {
    console.error('Error deleting leads:', error)
    res.status(500).json({ error: 'Failed to delete leads' })
  }
})

app.post('/leads/generate-messages', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leadIds, template } = req.body

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds must be a non-empty array' })
  }

  if (!template || typeof template !== 'string') {
    return res.status(400).json({ error: 'template must be a non-empty string' })
  }

  const unknownFields = findUnknownTemplateFields(template)
  if (unknownFields.length > 0) {
    return res.status(400).json({
      error: `Unknown field${unknownFields.length !== 1 ? 's' : ''} in template: ${unknownFields.map((field) => `{${field}}`).join(', ')}`,
      unknownFields,
    })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: {
        id: {
          in: leadIds.map((id) => Number(id)),
        },
      },
    })

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found with the provided IDs' })
    }

    let generatedCount = 0
    const errors: Array<{ leadId: number; leadName: string; error: string }> = []

    for (const lead of leads) {
      try {
        const message = generateMessageFromTemplate(template, lead)

        await prisma.lead.update({
          where: { id: lead.id },
          data: { message },
        })

        generatedCount++
      } catch (error) {
        errors.push({
          leadId: lead.id,
          leadName: `${lead.firstName} ${lead.lastName}`.trim(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    res.json({
      success: true,
      generatedCount,
      errors,
    })
  } catch (error) {
    console.error('Error generating messages:', error)
    res.status(500).json({ error: 'Failed to generate messages' })
  }
})

app.post('/leads/bulk', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leads } = req.body

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'leads must be a non-empty array' })
  }

  try {
    const validLeads = leads.filter(hasRequiredLeadFields)

    if (validLeads.length === 0) {
      return res
        .status(400)
        .json({ error: 'No valid leads found. firstName, lastName, and email are required.' })
    }

    const existingLeads = await prisma.lead.findMany({
      where: {
        OR: validLeads.map((lead) => ({
          AND: [{ firstName: lead.firstName.trim() }, { lastName: lead.lastName.trim() }],
        })),
      },
    })

    const leadKeys = new Set(
      existingLeads.map((lead) => `${lead.firstName.toLowerCase()}_${(lead.lastName || '').toLowerCase()}`)
    )

    const uniqueLeads = validLeads.filter((lead) => {
      const key = `${lead.firstName.toLowerCase()}_${lead.lastName.toLowerCase()}`
      return !leadKeys.has(key)
    })

    let importedCount = 0
    const errors: Array<{ lead: any; error: string }> = []

    for (const lead of uniqueLeads) {
      try {
        await prisma.lead.create({
          data: sanitizeImportedLead(lead),
        })
        importedCount++
      } catch (error) {
        errors.push({
          lead: lead,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    res.json({
      success: true,
      importedCount,
      duplicatesSkipped: validLeads.length - uniqueLeads.length,
      invalidLeads: leads.length - validLeads.length,
      errors,
    })
  } catch (error) {
    console.error('Error importing leads:', error)
    res.status(500).json({ error: 'Failed to import leads' })
  }
})

/** Validates `{ leadIds: number[] }` bodies; returns the de-duplicated ids or an error message. */
function parseLeadIds(body: unknown): { ids: number[] } | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body is required and must be valid JSON' }
  }

  const { leadIds } = body as { leadIds?: unknown }
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return { error: 'leadIds must be a non-empty array' }
  }

  const ids = [...new Set(leadIds.map((id) => Number(id)))]
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    return { error: 'leadIds must contain only positive integer ids' }
  }
  return { ids }
}

app.post('/leads/verify-emails', async (req: Request, res: Response) => {
  const parsed = parseLeadIds(req.body)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  try {
    const result = await startEmailVerification(parsed.ids)
    // 202: verification runs in the background; results arrive as `lead.updated` events on /leads/events.
    res.status(202).json(result)
  } catch (error) {
    console.error('Error starting email verification:', error)
    res.status(500).json({ error: 'Failed to start email verification' })
  }
})

app.post('/leads/enrich-phone', async (req: Request, res: Response) => {
  const parsed = parseLeadIds(req.body)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  try {
    const result = await startPhoneEnrichment(parsed.ids)
    // 202: enrichment runs in the background; progress arrives as `lead.updated` events on /leads/events.
    res.status(202).json(result)
  } catch (error) {
    console.error('Error starting phone enrichment:', error)
    res.status(500).json({ error: 'Failed to start phone enrichment' })
  }
})

app.listen(config.port, () => {
  console.log(`Express server is running on port ${config.port}`)
})

runTemporalWorker().catch((err) => {
  console.error(err)
  process.exit(1)
})
