import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaService } from '../../prisma/prisma.service'
import { KnowledgeService } from './knowledge.service'
import type { ChatMessageDto } from './dto/chat.dto'

const MAX_CONTEXT_CHUNKS = 3
const MAX_HISTORY_MESSAGES = 6

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name)
  private readonly anthropic = new Anthropic({
    apiKey: process.env['ANTHROPIC_API_KEY'],
  })
  private readonly model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6'

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
  ) {}

  // ─── Chat ───────────────────────────────────────────────────────────────────

  async chat(companyId: string, userId: string, dto: ChatMessageDto) {
    // 1. Get or create conversation
    let conversationId = dto.conversationId
    if (!conversationId) {
      const conv = await this.prisma.assistantConversation.create({
        data: {
          companyId,
          userId,
          title: dto.message.slice(0, 60),
        },
      })
      conversationId = conv.id
    } else {
      // Verify ownership
      const conv = await this.prisma.assistantConversation.findFirst({
        where: { id: conversationId, companyId, userId },
      })
      if (!conv) throw new NotFoundException('Conversation not found')
    }

    // 2. Retrieve relevant knowledge chunks (RAG)
    const chunks = await this.knowledge.searchChunks(companyId, dto.message, MAX_CONTEXT_CHUNKS)

    // 3. Build context from retrieved chunks
    const contextText =
      chunks.length > 0
        ? chunks
            .map(
              (c, i) =>
                `[Source ${i + 1}: ${c.documentTitle}]\n${c.content}`,
            )
            .join('\n\n---\n\n')
        : ''

    // 4. Load recent conversation history
    const history = await this.prisma.assistantMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
    })

    // 5. Build Anthropic messages
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
      {
        role: 'user' as const,
        content: dto.message,
      },
    ]

    const systemBlocks = this.buildSystemBlocks(contextText, chunks)

    // 6. Call Claude with prompt caching on the static system prefix
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemBlocks,
      messages,
    })

    const answer = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // 7. Build citations list
    const citations = chunks
      .filter((c) => c.similarity > 0.3)
      .map((c) => ({ documentTitle: c.documentTitle, documentId: c.documentId }))
      .filter((c, i, arr) => arr.findIndex((x) => x.documentId === c.documentId) === i)

    // 8. Persist messages
    await this.prisma.assistantMessage.createMany({
      data: [
        { conversationId, role: 'USER', content: dto.message },
        { conversationId, role: 'ASSISTANT', content: answer, citations: JSON.parse(JSON.stringify(citations)) },
      ],
    })

    // 9. Update conversation title if first exchange
    if (history.length === 0) {
      await this.prisma.assistantConversation.update({
        where: { id: conversationId },
        data: { title: dto.message.slice(0, 60) },
      })
    }

    return {
      conversationId,
      answer,
      citations,
    }
  }

  // ─── Conversations ──────────────────────────────────────────────────────────

  async listConversations(companyId: string, userId: string) {
    return this.prisma.assistantConversation.findMany({
      where: { companyId, userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    })
  }

  async getConversation(companyId: string, userId: string, conversationId: string) {
    const conv = await this.prisma.assistantConversation.findFirst({
      where: { id: conversationId, companyId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!conv) throw new NotFoundException('Conversation not found')
    return conv
  }

  async deleteConversation(companyId: string, userId: string, conversationId: string) {
    await this.prisma.assistantConversation.findFirstOrThrow({
      where: { id: conversationId, companyId, userId },
    })
    await this.prisma.assistantConversation.delete({ where: { id: conversationId } })
    return { deleted: true }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  // Returns content blocks with the static base cached via Anthropic prompt caching.
  // The dynamic chunk context (changes per query) is a separate, uncached block.
  private buildSystemBlocks(
    contextText: string,
    chunks: Array<{ documentTitle: string; similarity: number }>,
  ): Anthropic.TextBlockParam[] {
    const staticBase: Anthropic.TextBlockParam = {
      type: 'text',
      text: `You are an internal AI assistant for a CA firm in India. You help staff with GST compliance, TDS filings, client management, and general accounting procedures.

Rules:
- Answer only from the provided knowledge base context when available
- If no relevant context is found, say so clearly and answer from general CA/accounting knowledge
- Always reference the source document when citing information
- Be concise and professional
- Use Indian regulatory terminology (GST, TDS, ITR, PAN, GSTIN, etc.)
- Format amounts in Indian notation (₹1,23,456)
- Never hallucinate regulatory details — if unsure, say so`,
      cache_control: { type: 'ephemeral' },
    }

    if (contextText.length === 0) return [staticBase]

    const dynamicContext: Anthropic.TextBlockParam = {
      type: 'text',
      text: `## Knowledge Base Context\n${chunks.map((c, i) => `Source ${i + 1}: "${c.documentTitle}" (relevance: ${Math.round(c.similarity * 100)}%)`).join('\n')}\n\n${contextText}`,
    }

    return [staticBase, dynamicContext]
  }
}
