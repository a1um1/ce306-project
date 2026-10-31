import { AppHeader } from "@/components/layout/AppHeader";
import { getSession } from "@/lib/api/session";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/signin" });
    return { user: session.user };
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}
