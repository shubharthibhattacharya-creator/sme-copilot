import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { EmbeddingService } from './embedding.service'
import type { CreateKnowledgeDocumentDto } from './dto/knowledge.dto'

const CHUNK_SIZE = 800 // characters per chunk
const CHUNK_OVERLAP = 100

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

    // 3. Generate embeddings in batch
    const embeddings = await this.embedding.embedBatch(chunks)

    // 4. Store chunks with embeddings via raw SQL (Prisma doesn't support vector inserts natively)
    for (let i = 0; i < chunks.length; i++) {
      const vec = `[${embeddings[i]!.join(',')}]`
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
}
