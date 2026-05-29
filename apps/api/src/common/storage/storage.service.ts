import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export interface StorageUploadResult {
  key: string
  sizeBytes: number
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly uploadDir: string

  constructor() {
    this.uploadDir = process.env['UPLOAD_DIR'] ?? path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true })
    }
  }

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    companyId: string,
  ): Promise<StorageUploadResult> {
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const ext = this.getExtension(originalName, mimeType)
    const key = `${companyId}/${year}/${month}/${crypto.randomUUID()}${ext}`
    const fullPath = path.join(this.uploadDir, key)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, buffer)
    return { key, sizeBytes: buffer.length }
  }

  async readFile(key: string): Promise<Buffer> {
    const fullPath = path.join(this.uploadDir, key)
    return fs.readFileSync(fullPath)
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, key)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
  }

  // For local dev: returns the key itself (controller serves it)
  // Swap this method for S3 presigned URL generation in production
  getUrl(key: string): string {
    return `/api/v1/documents/file/${encodeURIComponent(key)}`
  }

  private getExtension(originalName: string, mimeType: string): string {
    const nameExt = path.extname(originalName)
    if (nameExt) return nameExt
    const mimeMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    }
    return mimeMap[mimeType] ?? ''
  }
}
