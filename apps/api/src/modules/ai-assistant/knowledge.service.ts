import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { EmbeddingService } from './embedding.service'
import type { CreateKnowledgeDocumentDto } from './dto/knowledge.dto'

const CHUNK_SIZE = 800 // characters per chunk
const CHUNK_OVERLAP = 100

// Stable content key for dedup — short SHA-256 hex of the chunk text
function chunkKey(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 32)
}

// Parse pgvector text representation "[0.1,-0.2,...]" into number[]
function parseVec(vecText: string): number[] {
  try {
    return JSON.parse(vecText) as number[]
  } catch {
    return vecText.replace(/^\[|\]$/g, '').split(',').map(Number)
  }
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    const end = Math.min(i + CHUNK_SIZE, text.length)
    chunks.push(text.slice(i, end).trim())
    i += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks.filter((c) => c.length > 20)
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async ingestDocument(companyId: string, dto: CreateKnowledgeDocumentDto) {
    // 1. Save the document
    const doc = await this.prisma.knowledgeDocument.create({
      data: { companyId, title: dto.title, category: dto.category, content: dto.content },
    })

    // 2. Chunk the content
    const chunks = splitIntoChunks(dto.content)
    this.logger.log(`Ingesting "${dto.title}": ${chunks.length} chunks`)

    // 3. Deduplicate embeddings — reuse existing vectors for unchanged chunks
    const uniqueChunks = [...new Set(chunks)]
    const existingEmbeddingMap = await this.fetchExistingEmbeddings(companyId, uniqueChunks)

    const chunksNeedingEmbed = uniqueChunks.filter((c) => !existingEmbeddingMap.has(chunkKey(c)))
    if (chunksNeedingEmbed.length > 0) {
      const newVecs = await this.embedding.embedBatch(chunksNeedingEmbed)
      chunksNeedingEmbed.forEach((c, i) => existingEmbeddingMap.set(chunkKey(c), newVecs[i]!))
    }

    const reused = chunks.length - chunksNeedingEmbed.length
    if (reused > 0) {
      this.logger.log(`Reused ${reused}/${chunks.length} embeddings from cache`)
    }

    // 4. Store chunks with embeddings via raw SQL (Prisma doesn't support vector inserts natively)
    for (let i = 0; i < chunks.length; i++) {
      const embedding = existingEmbeddingMap.get(chunkKey(chunks[i]!))!
      const vec = `[${embedding.join(',')}]`
      await this.prisma.$executeRaw`
        INSERT INTO "knowledge_chunks" ("id", "documentId", "companyId", "chunkIndex", "content", "embedding", "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${doc.id},
          ${companyId},
          ${i},
          ${chunks[i]!},
          ${vec}::vector,
          NOW()
        )
      `
    }

    return { ...doc, chunkCount: chunks.length }
  }

  async searchChunks(
    companyId: string,
    query: string,
    topK = 5,
  ): Promise<Array<{ content: string; documentId: string; documentTitle: string; similarity: number }>> {
    const queryEmbedding = await this.embedding.embed(query)
    const vec = `[${queryEmbedding.join(',')}]`

    const results = await this.prisma.$queryRaw<
      Array<{ content: string; documentId: string; title: string; similarity: number }>
    >`
      SELECT
        kc.content,
        kc."documentId",
        kd.title,
        1 - (kc.embedding <=> ${vec}::vector) AS similarity
      FROM   "knowledge_chunks" kc
      JOIN   "knowledge_documents" kd ON kd.id = kc."documentId"
      WHERE  kc."companyId" = ${companyId}
        AND  kd."isActive" = true
      ORDER  BY kc.embedding <=> ${vec}::vector
      LIMIT  ${topK}
    `

    return results.map((r) => ({
      content: r.content,
      documentId: r.documentId,
      documentTitle: r.title,
      similarity: Number(r.similarity),
    }))
  }

  async listDocuments(companyId: string) {
    return this.prisma.knowledgeDocument.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        category: true,
        isActive: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async deleteDocument(companyId: string, documentId: string) {
    const doc = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, companyId },
    })
    if (!doc) throw new NotFoundException('Knowledge document not found')

    await this.prisma.knowledgeDocument.delete({ where: { id: documentId } })
    return { deleted: true }
  }

  async toggleActive(companyId: string, documentId: string, isActive: boolean) {
    await this.prisma.knowledgeDocument.findFirstOrThrow({
      where: { id: documentId, companyId },
    })
    return this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { isActive },
    })
  }

  // ─── Embedding dedup helpers ─────────────────────────────────────────────────

  // Returns a map of chunkKey → embedding for all existing chunks in this company
  // whose content matches any of the provided chunks.
  private async fetchExistingEmbeddings(
    companyId: string,
    chunks: string[],
  ): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>()
    if (chunks.length === 0) return result

    const placeholders = chunks.map((_, i) => `$${i + 2}`).join(',')
    const rows = await this.prisma.$queryRawUnsafe<Array<{ content: string; embedding: string }>>(
      `SELECT content, embedding::text AS embedding
       FROM "knowledge_chunks"
       WHERE "companyId" = $1
         AND content IN (${placeholders})
       LIMIT 500`,
      companyId,
      ...chunks,
    )

    for (const row of rows) {
      const key = chunkKey(row.content)
      if (!result.has(key)) {
        result.set(key, parseVec(row.embedding))
      }
    }
    return result
  }
}
