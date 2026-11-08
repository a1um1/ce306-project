import {
  Mic,
  PenLine,
  MessageSquare,
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

const VoiceMock = () => (
  <div className={styles.mock}>
    <div className={styles.player}>
      <span className={styles.play} aria-hidden>
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M5 3l8 5-8 5z" fill="#fff" />
        </svg>
      </span>
      <span className={styles.wave} aria-hidden>
        {WAVE.map((h, i) => (
          <i key={i} style={{ height: h }} />
        ))}
      </span>
      <span className={styles.time}>0:07</span>
    </div>
  </div>
);

const HandMock = () => (
  <div className={styles.mock}>
    <div className={styles.paper}>
      <p className={styles.line}>ค่าอาหารกลางวัน ฿150</p>
      <p className={styles.line}>ค่าน้ำมันรถ ฿500</p>
      <p className={`${styles.line} ${styles.noted}`}>กาแฟตอนเช้า ฿60</p>
    </div>
  </div>
);

const ChatMock = () => (
  <div className={`${styles.mock} ${styles.chatMock}`}>
    <div className={styles.me}>ปลาทู 40 บาท</div>
    <div className={styles.you}>
      <Mic size={14} strokeWidth={1.8} /> จดให้แล้วปัง!
    </div>
  </div>
);

export const FeatureGrid = () => {
  return (
    <section className={styles.section}>
      <div className="container mx-auto flex max-w-[1200px] flex-col gap-4 px-4">
        <div className="grid gap-4 md:grid-cols-3">
          <article className={styles.card}>
            <div className={`${styles.visual} ${styles.voice}`}>
              <VoiceMock />
            </div>
            <div className={styles.copy}>
              <h2 className="text-2xl font-bold">จดด้วยเสียง</h2>
              <p>พูดว่า “ปลาทู 40 บาท” ระบบจดให้อัตโนมัติ</p>
            </div>
          </article>

          <article className={styles.card}>
            <div className={`${styles.visual} ${styles.hand}`}>
              <HandMock />
            </div>
            <div className={styles.copy}>
              <h2 className="text-2xl font-bold">จดด้วยลายมือ</h2>
              <p>ถ่ายรูปหรือสแกนลายมือ ระบบอ่านให้เลย</p>
            </div>
          </article>

          <article className={styles.card}>
            <div className={`${styles.visual} ${styles.chat}`}>
              <ChatMock />
            </div>
            <div className={styles.copy}>
              <h2 className="text-2xl font-bold">พิมพ์จดผ่านแชท</h2>
              <p>พิมพ์บอกแชท ระบบจดให้เร็วทันใจ</p>
            </div>
          </article>
        </div>

        <div className={styles.other}>
          <h3 className="text-2xl font-bold">ฟีเจอร์อื่นๆ</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {PILLS.map(({ label, Icon }) => (
              <span key={label} className={styles.pill}>
                <Icon size={20} strokeWidth={1.8} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
