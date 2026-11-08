import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Modal } from "@/components/ui/Modal";
import styles from "./signinModal.module.css";
import { GoogleLogo } from "@/components/logo/google";
import { LineLogo } from "@/components/logo/line";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function signIn(provider: "google" | "line") {
  return authClient.signIn.social({
    provider,
    callbackURL: `${window.location.origin}/dashboard`,
    errorCallbackURL: window.location.origin,
  });
}

export const SignInModal = ({ open, onOpenChange }: Props) => {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      width={600}
      containerClassName={"px-12! py-12! rounded-2xl!"}
    >
      <h1 className="text-center mb-4 text-4xl font-bold">เริ่มจดรายจ่ายกัน</h1>
      <div className={styles.actions}>
        <Button variant="secondary" size="lg" fullWidth onClick={() => void signIn("google")}>
          <GoogleLogo />
          Sign in with Google
        </Button>
        <Button variant="line" size="lg" fullWidth onClick={() => void signIn("line")}>
          <LineLogo />
          Sign in with LINE
        </Button>
      </div>
    </Modal>
  );
};
