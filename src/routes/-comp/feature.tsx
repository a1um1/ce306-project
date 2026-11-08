import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
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

const MOBILE = "(max-width: 640px)";

function useIsMobile() {
  // Start false so server and client markup match; the effect corrects it.
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = matchMedia(MOBILE);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

const Slip = ({
  src,
  bank,
  i,
  progress,
  spread,
}: {
  src: string;
  bank: string;
  i: number;
  progress: MotionValue<number>;
  spread: number;
}) => {
  const d = i - (SLIPS.length - 1) / 2;
  const ad = Math.abs(d);
  const pile = PILE[i];
  // Stagger the sort so cards land one after another.
  const range = [i * 0.05, 1];
  const x = useTransform(progress, range, [pile.x, d * spread]);
  const y = useTransform(progress, range, [pile.y, ad * ad * 14]);
  const rotate = useTransform(progress, range, [pile.rotate, d * 9]);
  const scale = useTransform(progress, range, [pile.scale, 1]);

  return (
    <motion.div
      className={styles.card}
      style={{ x, y, rotate, scale, zIndex: 10 - Math.round(ad * 2) }}
    >
      <img src={src} alt={`สลิป ${bank}`} />
    </motion.div>
  );
};

export const FeatureComponent = () => {
  const deckRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: deckRef,
    offset: ["start end", "center 60%"],
  });
  const reduceMotion = useReducedMotion();
  const progress = useTransform(scrollYProgress, (v) => {
    if (reduceMotion) return 1;
    const t = Math.min(1, Math.max(0, v));
    return t * t * (3 - 2 * t);
  });
  const spread = useIsMobile() ? 48 : 90;

  return (
    <section className={styles.section}>
      <div className="container mx-auto flex flex-col items-center gap-12 px-4 md:flex-row md:gap-16">
        <div ref={deckRef} className={styles.deck} aria-label="ตัวอย่างสลิปโอนเงิน">
          {SLIPS.map((slip, i) => (
            <Slip key={slip.bank} {...slip} i={i} progress={progress} spread={spread} />
          ))}
        </div>

        <div className="flex max-w-lg flex-col gap-4">
          <h1 className="text-4xl font-bold">จดรายจ่ายอัตโนมัติ</h1>
          <p className="text-2xl">แค่อัพโหลดสลิปโอนเงินระบบจะจดรายจ่ายอัตโนมัติ</p>
        </div>
      </div>
    </section>
  );
};
