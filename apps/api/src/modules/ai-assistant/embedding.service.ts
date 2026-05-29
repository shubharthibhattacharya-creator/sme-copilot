import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name)
  private readonly client: OpenAI | null
  private readonly model = 'text-embedding-3-small'
  readonly dimensions = 1536

  constructor() {
    const key = process.env['OPENAI_API_KEY']
    if (key && !key.startsWith('sk-placeholder')) {
      this.client = new OpenAI({ apiKey: key })
    } else {
      this.logger.warn('OpenAI API key not configured — embeddings will be zeroed out')
      this.client = null
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.client) {
      // Return zero vector for dev without OpenAI key
      return Array(this.dimensions).fill(0) as number[]
    }
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text.slice(0, 8192), // model context limit
    })
    return response.data[0]!.embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      return texts.map(() => Array(this.dimensions).fill(0) as number[])
    }
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts.map((t) => t.slice(0, 8192)),
    })
    return response.data.map((d) => d.embedding)
  }
}
