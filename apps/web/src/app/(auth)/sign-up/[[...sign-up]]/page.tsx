// Self-service signup is disabled.
// All accounts are provisioned via the OpsCopilot admin panel.
import { redirect } from 'next/navigation'

export default function SignUpPage() {
  redirect('/sign-in')
}
