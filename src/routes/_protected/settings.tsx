import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getLineAccount } from "@/lib/api/line";
import { Button } from "@/components/ui/Button";
import { LineLogo } from "@/components/logo/line";
import page from "@/components/layout/page.module.css";

export const Route = createFileRoute("/_protected/settings")({
  component: Settings,
});

function useLineAccount() {
  return useQuery({
    queryKey: ["line-account"],
    queryFn: getLineAccount,
    staleTime: 1000 * 60, // 1 minute
  });
}

function linkLine() {
  void authClient.linkSocial({
    provider: "line",
    callbackURL: "/settings",
    errorCallbackURL: "/settings",
  });
}

function Settings() {
  const { data: lineAccount } = useLineAccount();
  const [linking, setLinking] = useState(false);

  return (
    <div className={page.page}>
      <div className={page.container}>
        <div className={page.headerRow}>
          <h2 className={page.listTitle}>การตั้งค่า</h2>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 12,
            padding: 18,
            border: "2px solid var(--border)",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 500 }}>การจัดการบัญชี</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 14, color: "var(--muted)", maxWidth: 520 }}>
              {lineAccount
                ? "เชื่อมต่อบัญชี LINE แล้ว จดรายจ่ายผ่านแชทบอทได้เลย"
                : "เชื่อมต่อบัญชี LINE เพื่อจดรายจ่ายผ่านแชทบอท (LINE Login OAuth)"}
            </div>
            {lineAccount ? (
              <Button variant="outline" size="sm" disabled>
                <LineLogo />
                เชื่อมต่อแล้ว
              </Button>
            ) : (
              <Button
                variant="line"
                size="sm"
                disabled={linking}
                onClick={() => {
                  setLinking(true);
                  linkLine();
                }}
              >
                <LineLogo />
                เชื่อมต่อ LINE
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
