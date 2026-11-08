import { Button } from "@/components/ui/Button";
import styles from "./cta.module.css";

export const Cta = ({ onSignIn }: { onSignIn: () => void }) => {
  return (
    <section className={styles.section}>
      <div className="container mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 text-center">
        <h2 className="text-4xl font-bold">อยากใช้แล้วอะดิ</h2>
        <p className="text-xl text-[#5a5a5a]">เริ่มจดรายจ่ายเลยวันนี้ ฟรี!</p>
        <Button size="lg" onClick={onSignIn}>
          เริ่มจดกันเลย!
        </Button>
      </div>
    </section>
  );
};

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <a href="https://github.com/a1um1" target="_blank" rel="noreferrer">
        Copyright © {new Date().getFullYear()} a1um1
      </a>
    </footer>
  );
};
