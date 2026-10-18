import { PrismaClient } from '@prisma/client'

/** Single Prisma client shared by the API routes and the Temporal activities running in this process. */
export const prisma = new PrismaClient()
