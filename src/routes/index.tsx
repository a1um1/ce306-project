import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { FeatureComponent } from "@/routes/-comp/feature";
import { FeatureGrid } from "@/routes/-comp/featureGrid";
import { Cta, Footer } from "@/routes/-comp/cta";
import { SignInModal } from "@/routes/-comp/signinModal";
import landing from "@/routes/-comp/landing.module.css";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

const HEADLINE = "มาจดรายจ่ายกานนนนน";

function RouteComponent() {
  const [signinOpen, setSigninOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div>
      <header className={`${landing.header} ${scrolled ? landing.scrolled : ""}`}>
        <div className="container flex h-full items-center justify-between">
          <Link
            to="/"
            search={{
              range: "today",
              year: new Date().getFullYear(),
            }}
            style={{ textDecoration: "none" }}
            aria-label="PayTail หน้าแรก"
          >
            <Logo size="sm" />
          </Link>

          <Button variant="secondary" size="md" onClick={() => setSigninOpen(true)}>
            เข้าสู่ระบบ
          </Button>
        </div>
      </header>

      <section className={landing.hero}>
        <div className={`container ${landing.heroInner}`}>
          <h1 className={landing.heroTitle} aria-label={HEADLINE}>
            {HEADLINE.split("").map((ch, i) => (
              <motion.span
                key={i}
                className={landing.heroChar}
                initial={reduced ? false : { y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.6, delay: i * 0.04, ease: "easeOut" }
                }
              >
                {ch}
              </motion.span>
            ))}
          </h1>
          <div className={landing.heroCta}>
            {[
              <Button key="a" size="xl" className={landing.ctaBtn} onClick={() => setSigninOpen(true)}>
                เริ่มจดกันเลย!
              </Button>,
              <Button
                key="b"
                variant="line"
                size="xl"
                className={landing.ctaBtn}
                onClick={() => setSigninOpen(true)}
              >
                จดผ่าน Line ได้น้า
              </Button>,
            ].map((btn, i) => (
              <motion.div
                key={i}
                initial={reduced ? false : { scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 400,
                        damping: 18,
                        delay: 1.05 + i * 0.12,
                      }
                }
              >
                {btn}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <FeatureComponent />
      <FeatureGrid />
      <Cta onSignIn={() => setSigninOpen(true)} />
      <Footer onSignIn={() => setSigninOpen(true)} />
      <SignInModal open={signinOpen} onOpenChange={setSigninOpen} />
    </div>
  );
}
