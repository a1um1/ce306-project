import { useRef } from "react";
import { useInView } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import styles from "./cta.module.css";

export const Cta = ({ onSignIn }: { onSignIn: () => void }) => {
  const ref = useRef<HTMLElement>(null);
  const on = useInView(ref, { amount: 0.3 });

  return (
    <section ref={ref} className={`${styles.section} ${on ? styles.on : ""}`}>
      <div className="container">
        <div className={styles.panel}>
          <h2 className={styles.title}>อยากใช้แล้วอะดิ</h2>
          <p className={styles.sub}>เริ่มจดรายจ่ายเลยวันนี้ ฟรี!</p>
          <div className={styles.ctaRow}>
            <Button size="xl" className={`${styles.ctaBtn} ${styles.glow}`} onClick={onSignIn}>
              เริ่มจดกันเลย!
            </Button>
            <Button variant="line" size="xl" className={styles.ctaBtn} onClick={onSignIn}>
              จดผ่าน Line ได้น้า
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export const Footer = ({ onSignIn }: { onSignIn: () => void }) => {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Logo size="sm" />
          <p className={styles.tagline}>เริ่มจดรายจ่ายเลยวันนี้ ฟรี!</p>
        </div>

        <nav className={styles.links} aria-label="ลิงก์ท้ายหน้า">
          <a href="#features">ฟีเจอร์</a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSignIn();
            }}
          >
            เข้าสู่ระบบ
          </a>
          <a href="https://github.com/a1um1" target="_blank" rel="noreferrer">
            ติดต่อเรา
          </a>
        </nav>
      </div>
    </footer>
  );
};
