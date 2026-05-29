import { CreateTenantForm } from '@/components/CreateTenantForm'

export default function NewTenantPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Create tenant</h1>
        <p className="text-sm text-gray-400 mt-1">Provision a new firm + send Clerk invitation</p>
      </div>
      <CreateTenantForm />
    </div>
  )
}
