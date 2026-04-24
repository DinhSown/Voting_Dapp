
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const elections = await prisma.election.findMany({
    select: { id: true, title: true, isActive: true, isEnded: true }
  })
  console.log(JSON.stringify(elections, null, 2))
}
main().catch(console.error).finally(() => prisma.$disconnect())
