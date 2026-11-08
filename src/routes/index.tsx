import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { FeatureComponent } from "@/routes/-comp/feature";
import { FeatureGrid } from "@/routes/-comp/featureGrid";
import { Cta, Footer } from "@/routes/-comp/cta";
import { SignInModal } from "@/routes/-comp/signinModal";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [signinOpen, setSigninOpen] = useState(false);

  return (
    <div>
      <header className="flex items-center justify-between px-4 py-2 fixed top-0 left-0 right-0 z-10">
        <Link
          to="/"
          search={{
            range: "today",
            year: new Date().getFullYear(),
          }}
          style={{ textDecoration: "none" }}
        >
          <Logo size="sm" />
        </Link>

        <Button variant="secondary" size="md" onClick={() => setSigninOpen(true)}>
          เข้าสู่ระบบ
        </Button>
      </header>
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-10rem)] gap-4 bg-linear-0 from-orange-200 to-yellow-100-900">
        <div className="flex flex-col gap-4">
          <h1 className="text-7xl font-bold">มาจดรายจ่ายกานนนนน</h1>
          <div className="flex gap-4 flex-row flex-wrap">
            <Button size="lg" onClick={() => setSigninOpen(true)}>
              เริ่มจดกันเลย!
            </Button>
            <Button variant="line" size="lg" onClick={() => setSigninOpen(true)}>
              จดผ่าน Line ได้น้า
            </Button>
          </div>
        </div>
      </div>
      <FeatureComponent />
      <FeatureGrid />
      <Cta onSignIn={() => setSigninOpen(true)} />
      <Footer />
      <SignInModal open={signinOpen} onOpenChange={setSigninOpen} />
    </div>
  );
}
