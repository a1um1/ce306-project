import { createFileRoute, Link } from "@tanstack/react-router";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Logo } from "@/components/ui/Logo";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px" }}>
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
          Sign In
        </ButtonLink>
      </header>
    </div>
  );
}
