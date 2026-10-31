import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <header>
        <Link
          to="/"
          search={{
            range: "today",
            year: new Date().getFullYear(),
          }}
        >
          <span>
            <img src="/assets/logo-slip.svg" alt="" width={34} height={34} />
          </span>
          <span>PayTail</span>
        </Link>

        <Link to="/signin">Sign In</Link>
      </header>
    </div>
  );
}
