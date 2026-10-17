import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { getSession } from '@/lib/api/session'
import styles from './signin.module.css'

export const Route = createFileRoute('/signin')({
  beforeLoad: async () => {
    const session = await getSession()
    if (session) throw redirect({ to: '/' })
  },
  component: SignIn,
})

function SignIn() {
  return (
    <main className={styles.page}>
      <img src="/assets/signin-bg.svg" alt="" className={styles.bg} width={900} height={866} />
      <span className={styles.logo}>
        <img src="/assets/logo-slip.svg" alt="" width={70} height={70} className={styles.logoImg} />
      </span>
      <h1 className={styles.title}>PayTail</h1>
      <p className={styles.tagline}>เงินมันไปไหนวะ?</p>
      <button
        type="button"
        className={styles.button}
        onClick={() => authClient.signIn.social({ provider: 'google' })}
      >
        Sign in with Google
      </button>
    </main>
  )
}
