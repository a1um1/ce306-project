import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/api/session";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { defaultDashSearch } from "./_protected/dashboard";
import styles from "./signin.module.css";

export const Route = createFileRoute("/signin")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session) throw redirect({ to: "/dashboard", search: defaultDashSearch() });
  },
  component: SignIn,
});

function SignIn() {
  return (
    <main className={styles.page}>
      <img src="/assets/signin-bg.svg" alt="" className={styles.bg} width={900} height={866} />
      <Logo size="lg" layout="vertical" textAs="h1" />
      <p className={styles.tagline}>เงินมันไปไหนวะ?</p>
      <Button
        variant="secondary"
        size="lg"
        onClick={() =>
          authClient.signIn.social({
            provider: "google",
            callbackURL: `${window.location.origin}/dashboard`,
            errorCallbackURL: `${window.location.origin}/signin`,
          })
        }
      >
        Sign in with Google
      </Button>
    </main>
  );
}
