import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import styles from "./feature.module.css";

const SLIPS = [
  { src: "/bankSlipMock/Kbank.svg", bank: "KBANK" },
  { src: "/bankSlipMock/KTB.svg", bank: "KTB" },
  { src: "/bankSlipMock/SCB.svg", bank: "SCB" },
  { src: "/bankSlipMock/BBL.svg", bank: "BBL" },
  { src: "/bankSlipMock/TTB.svg", bank: "TTB" },
];

// Fixed "random" pile so SSR and client agree; not Math.random().
const PILE = [
  { x: -10, y: 6, rotate: -8, scale: 0.96 },
  { x: 8, y: -10, rotate: 5, scale: 0.98 },
  { x: -4, y: 10, rotate: -3, scale: 1 },
  { x: 14, y: -2, rotate: 9, scale: 0.97 },
  { x: 2, y: 14, rotate: -6, scale: 0.95 },
];

// Last slip lands ~ (0.7s + 4 * 0.12s stagger); scan starts then.
const LAND_MS = 1250;
const SCAN_MS = 900;

const EASE = [0.2, 0.8, 0.2, 1] as const;
const SPREAD = 50;

export const FeatureComponent = () => {
  const deckRef = useRef<HTMLDivElement>(null);
  const inView = useInView(deckRef, { amount: 0.35, once: true });
  const reduced = useReducedMotion();

  // Fan-out as the stack crosses the viewport; fixed at rest spread if reduced.
  const { scrollYProgress } = useScroll({
    target: deckRef,
    offset: ["start end", "center 60%"],
  });
  const progress = useTransform(scrollYProgress, (v) => {
    if (reduced) return 1;
    const t = Math.min(1, Math.max(0, v));
    return t * t * (3 - 2 * t);
  });

  // Random ±14° drop rotation, generated once on the client only
  // (keeps SSR HTML stable; the deck is decorative/aria-hidden).
  const [rot, setRot] = useState<number[]>([]);
  const ready = rot.length === SLIPS.length;

  // 1 = dropping, 2 = scanning, 3 = done. Replays on re-enter.
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setRot(SLIPS.map(() => Math.round((Math.random() * 28 - 14) * 10) / 10));
  }, []);

  useEffect(() => {
    if (reduced) {
      setPhase(3);
      return;
    }
    if (inView && ready) {
      setPhase(1);
      const t1 = setTimeout(() => setPhase(2), LAND_MS);
      const t2 = setTimeout(() => setPhase(3), LAND_MS + SCAN_MS);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        setPhase(0);
      };
    }
    setPhase(0);
  }, [inView, reduced, ready]);

  return (
    <section id="showcase" className={styles.section}>
      <div className={styles.grid}>
        <motion.div
          className={styles.copy}
          initial={reduced ? false : { x: 24, opacity: 0 }}
          animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: 24, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          <h2 className={styles.title}>จดรายจ่ายอัตโนมัติ</h2>
          <p className={styles.sub}>แค่อัพโหลดสลิปโอนเงินระบบจะจดรายจ่ายอัตโนมัติ</p>
          <a className={styles.try} href="#features">
            ลองเลย →
          </a>
        </motion.div>

        <div ref={deckRef} className={styles.deck} aria-hidden="true" aria-label="ตัวอย่างสลิปโอนเงิน">
          {SLIPS.map((slip, i) => (
            <Slip
              key={slip.bank}
              src={slip.src}
              i={i}
              phase={phase}
              rot={rot[i] ?? 0}
              progress={progress}
              reduced={!!reduced}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const Slip = ({
  src,
  i,
  phase,
  rot,
  progress,
  reduced,
}: {
  src: string;
  i: number;
  phase: number;
  rot: number;
  progress: MotionValue<number>;
  reduced: boolean;
}) => {
  const d = i - (SLIPS.length - 1) / 2;
  const ad = Math.abs(d);
  const pile = PILE[i];
  const range = [i * 0.05, 1];
  const x = useTransform(progress, range, [pile.x, d * SPREAD]);
  const y = useTransform(progress, range, [pile.y, ad * ad * 16]);
  const rotate = useTransform(progress, range, [pile.rotate, d * 9]);
  const scale = useTransform(progress, range, [pile.scale, 1]);

  return (
    <motion.div
      className={styles.slot}
      style={{ zIndex: 10 - Math.round(ad * 2) }}
      initial={reduced ? false : { y: -120, opacity: 0, rotate: rot }}
      animate={phase >= 1 ? { y: 0, opacity: 1, rotate: 0 } : { y: -120, opacity: 0, rotate: rot }}
      transition={
        reduced || phase < 1 ? { duration: 0 } : { duration: 0.7, delay: i * 0.12, ease: EASE }
      }
    >
      {/* Fan lives on the inner card so the drop can't fight it. */}
      <motion.div className={styles.card} style={{ x, y, rotate, scale }}>
        <img src={src} alt="" />0
        {i === Math.trunc((SLIPS.length - 1) / 2) && (
          <>
            {/* Scan line sweeping the front slip, fired after the drops land. */}
            <motion.div
              className={styles.scan}
              initial={{ top: "0%", opacity: 0 }}
              animate={
                phase === 2
                  ? { top: ["0%", "100%"], opacity: [0, 1, 1, 0] }
                  : phase >= 3
                    ? { top: "100%", opacity: 0 }
                    : { top: "0%", opacity: 0 }
              }
              transition={reduced ? { duration: 0 } : { duration: 0.9, ease: "easeInOut" }}
            />
            {/* Green check badge, appears once the scan has passed. */}
            <motion.div
              className={styles.check}
              initial={reduced ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
              animate={phase >= 3 ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 400, damping: 16, delay: 0.1 }
              }
            >
              ✓
            </motion.div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};
