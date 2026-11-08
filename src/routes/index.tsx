import { createFileRoute, Link } from "@tanstack/react-router";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Logo } from "@/components/ui/Logo";
import { FeatureComponent } from "@/routes/-comp/feature";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
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

        <ButtonLink to="/signin" variant="secondary" size="md">
          เข้าสู่ระบบ
        </ButtonLink>
      </header>
      <div className="flex flex-col items-center justify-center h-[40rem] gap-4 bg-linear-0 from-orange-200 to-yellow-100-900">
        <div className="flex flex-col gap-4">
          <h1 className="text-7xl font-bold">มาจดรายจ่ายกานนนนน</h1>
          <div className="flex gap-4 flex-row flex-wrap">
            <ButtonLink to="/signin" variant="secondary" size="lg">
              เริ่มจดกันเลย!
            </ButtonLink>
            <ButtonLink to="/signin" variant="secondary" size="lg">
              จดผ่าน Line ได้น้า
            </ButtonLink>
          </div>
        </div>
      </div>
      <FeatureComponent />
    </div>
  );
}
