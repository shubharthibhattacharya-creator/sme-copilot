import { Injectable, Logger } from '@nestjs/common'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface StorageUploadResult {
  key: string
  sizeBytes: number
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly s3?: S3Client
  private readonly bucket?: string
  private readonly uploadDir!: string

  constructor() {
    this.bucket = process.env['S3_BUCKET']

    if (this.bucket) {
      // Normalize endpoint: strip accidental surrounding quotes, add https:// if missing
      const rawEndpoint = process.env['S3_ENDPOINT']?.replace(/^["']|["']$/g, '')
      let endpoint: string | undefined
      if (rawEndpoint) {
        endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`
        if (endpoint !== process.env['S3_ENDPOINT']) {
          this.logger.warn(`S3_ENDPOINT was normalized from "${process.env['S3_ENDPOINT']}" to "${endpoint}"`)
        }
      }

      const stripQuotes = (v: string | undefined) => v?.replace(/^["']|["']$/g, '') ?? ''
      this.s3 = new S3Client({
        region: process.env['S3_REGION'] ?? 'auto',
        credentials: {
          accessKeyId: stripQuotes(process.env['S3_ACCESS_KEY_ID']),
          secretAccessKey: stripQuotes(process.env['S3_SECRET_ACCESS_KEY']),
        },
        ...(endpoint ? { endpoint } : {}),
        // Use path-style URLs (https://endpoint/bucket/key) instead of virtual-hosted
        // (https://bucket.endpoint/key). Required for Cloudflare R2 and MinIO.
        forcePathStyle: true,
      })
      this.logger.log(`StorageService: S3/R2 bucket "${this.bucket}" endpoint="${endpoint ?? 'default'}"`)
    } else {
      this.uploadDir = process.env['UPLOAD_DIR'] ?? path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true })
      }
      this.logger.warn('S3_BUCKET not set — using local disk (not suitable for production)')
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

    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ContentLength: buffer.length,
        }),
      )
    } else {
      const fullPath = path.join(this.uploadDir, key)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, buffer)
    }

    return { key, sizeBytes: buffer.length }
  }

  async readFile(key: string): Promise<Buffer> {
    if (this.s3 && this.bucket) {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      )
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    }
    return fs.readFileSync(path.join(this.uploadDir, key))
  }

  async delete(key: string): Promise<void> {
    if (this.s3 && this.bucket) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      return
    }
    const fullPath = path.join(this.uploadDir, key)
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
  }

  async getUrl(key: string): Promise<string> {
    if (this.s3 && this.bucket) {
      return getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: 3600 },
      )
    }
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
