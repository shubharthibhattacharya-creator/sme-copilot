import { UploadPage } from '@/components/upload/UploadPage'

interface Props {
  params: Promise<{ token: string }>
}

export default async function PublicUploadPage({ params }: Props) {
  const { token } = await params
  return <UploadPage token={token} />
}
