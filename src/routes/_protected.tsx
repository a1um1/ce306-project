import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { ImportBanner } from '@/components/expense/ImportBanner'
import { getSession } from '@/lib/api/session'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/signin' })
    return { user: session.user }
  },
  component: ProtectedLayout,
})

function ProtectedLayout() {
  return (
    <>
      <Outlet />
      <ImportBanner />
    </>
  )
}
