import { adminApi } from '@/lib/admin-api'
import { TenantDetail } from '@/components/TenantDetail'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function TenantPage({ params }: Props) {
  const { id } = await params
  const [tenant, config, knowledge, audit] = await Promise.all([
    adminApi.tenants.get(id).catch(() => null),
    adminApi.config.list(id).catch(() => []),
    adminApi.knowledge.list(id).catch(() => []),
    adminApi.audit({ limit: 100, companyId: id }).catch(() => []),
  ])

  if (!tenant) notFound()

  return <TenantDetail tenant={tenant} config={config} knowledge={knowledge} audit={audit} />
}
