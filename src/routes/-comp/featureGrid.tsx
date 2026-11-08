import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  Mic,
  History,
  Tag,
  Wand2,
  BarChart3,
  MessageCircle,
  Search,
  Paperclip,
  FileDown,
} from "lucide-react";
import styles from "./featureGrid.module.css";

const PILLS = [
  { label: "ดูย้อนหลังไม่จำกัด", Icon: History },
  { label: "จัดหมวดหมู่", Icon: Tag },
  { label: "จัดหมวดหมู่อัตโนมัติ", Icon: Wand2 },
  { label: "Dashboard สรุป", Icon: BarChart3 },
  { label: "จดผ่าน Line", Icon: MessageCircle },
  { label: "ค้นหารายจ่าย", Icon: Search },
  { label: "แนบรูปสลิป", Icon: Paperclip },
  { label: "ส่งออกรายงาน", Icon: FileDown },
];

// Fixed bar heights so the waveform renders identically on server and client.
const WAVE = [5, 11, 7, 14, 9, 17, 6, 12, 8, 15, 5, 11, 7, 13, 9];

/** 0:00 -> 0:07 count-up, once, gated by `start`. Final state when reduced. */
function Timer({ start }: { start: boolean }) {
  const reduced = useReducedMotion();
  const [s, setS] = useState(0);
  useEffect(() => {
    if (reduced) {
      setS(7);
      return;
    }
    if (!start) {
      setS(0);
      return;
    }
    const id = setInterval(
      () =>
        setS((v) => {
          if (v >= 7) {
            clearInterval(id);
            return v;
          }
          return v + 1;
        }),
      280
    );
    return () => clearInterval(id);
  }, [start, reduced]);
  return <span className={styles.time}>0:0{s}</span>;
}

const VoiceMock = ({ live }: { live: boolean }) => (
  <div className={styles.mock}>
    <div className={styles.player}>
      <span className={styles.play} aria-hidden>
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M5 3l8 5-8 5z" fill="#fff" />
        </svg>
      </span>
      <span className={styles.wave} aria-hidden>
        {WAVE.map((h, i) => (
          <i key={i} style={{ height: h, "--d": `${i * 0.1}s` } as CSSProperties} />
        ))}
      </span>
      <Timer start={live} />
    </div>
  </div>
);

const HandMock = () => (
  <div className={styles.mock}>
    <div className={styles.paper}>
      <p className={styles.line}>ค่าอาหารกลางวัน ฿150</p>
      <p className={styles.line}>ค่าน้ำมันรถ ฿500</p>
      <p className={`${styles.line} ${styles.noted}`}>กาแฟตอนเช้า ฿60</p>
      <span className={styles.handCheck} aria-hidden>
        ✓
      </span>
    </div>
  </div>
);

const ChatMock = () => (
  <div className={`${styles.mock} ${styles.chatMock}`}>
    <div className={styles.typing} aria-hidden>
      <i />
      <i />
      <i />
    </div>
    <div className={styles.reply}>จดให้แล้วปัง!</div>
    <div className={styles.user}>
      <Mic size={18} strokeWidth={1.8} /> ปลาทู 40 บาท
    </div>
  </div>
);

export const FeatureGrid = () => {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { amount: 0.3, once: true }); // one-shot reveals
  const inViewNow = useInView(ref, { amount: 0.1 }); // ambient loops pause offscreen
  const reduced = useReducedMotion();
  const live = !reduced && seen;
  const ambient = !reduced && inViewNow;
  const door = reduced ? styles.done : live ? styles.live : "";

  return (
    <section
      id="features"
      ref={ref}
      className={`${styles.section} ${door} ${ambient ? styles.on : ""}`}
    >
      <div className="container">
        <div className={styles.cards}>
          <motion.article
            className={styles.card}
            initial={reduced ? false : { y: 32, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ amount: 0.2, once: true }}
            transition={
              reduced ? { duration: 0 } : { duration: 0.5, delay: 0, ease: "easeOut" }
            }
          >
            <div className={`${styles.visual} ${styles.voice}`}>
              <VoiceMock live={live} />
            </div>
            <div className={styles.copy}>
              <h2 className={styles.cardTitle}>จดด้วยเสียง</h2>
              <p>
                พูดว่า “ปลาทู 40 บาท” แล้วระบบจะจดรายจ่ายให้อัตโนมัติ แค่บอกว่าซื้อ อะไรเท่าไหร่ก็จบ
                ไม่ต้องพิมพ์ทีละบรรทัด
              </p>
            </div>
          </motion.article>

          <motion.article
            className={styles.card}
            initial={reduced ? false : { y: 32, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ amount: 0.2, once: true }}
            transition={
              reduced ? { duration: 0 } : { duration: 0.5, delay: 0.1, ease: "easeOut" }
            }
          >
            <div className={`${styles.visual} ${styles.hand}`}>
              <HandMock />
            </div>
            <div className={styles.copy}>
              <h2 className={styles.cardTitle}>จดด้วยลายมือ</h2>
              <p>
                ถ่ายรูปหรือสแกนจากกระดาษที่เขียนไว้ ระบบอ่านแล้วแปลงเป็นรายจ่ายให้ เลย ไม่ต้องนั่งพิมพ์ทีละรายการเอง
              </p>
            </div>
          </motion.article>

          <motion.article
            className={styles.card}
            initial={reduced ? false : { y: 32, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ amount: 0.2, once: true }}
            transition={
              reduced ? { duration: 0 } : { duration: 0.5, delay: 0.2, ease: "easeOut" }
            }
          >
            <div className={`${styles.visual} ${styles.chat}`}>
              <ChatMock />
            </div>
            <div className={styles.copy}>
              <h2 className={styles.cardTitle}>พิมพ์จดผ่านแชท</h2>
              <p>พิมพ์บอกแชทว่าจ่ายอะไรไปเท่าไหร่ ระบบจดให้ทุกครั้ง เร็วทันใจ ไม่ตกหล่น และแนบสลิปรูปได้ด้วยนะ</p>
            </div>
          </motion.article>
        </div>

        <div className={styles.other}>
          <h3 className={styles.otherTitle}>ฟีเจอร์อื่นๆ</h3>
          <div className={styles.pills}>
            {PILLS.map(({ label, Icon }, i) => (
              <motion.span
                key={label}
                className={styles.pill}
                initial={reduced ? false : { y: 16, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ amount: 0.5, once: true }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.5, delay: i * 0.04, ease: "easeOut" }
                }
              >
                <Icon size={20} strokeWidth={1.8} />
                {label}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
