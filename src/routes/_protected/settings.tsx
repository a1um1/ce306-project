import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import page from "@/components/layout/page.module.css";

const parent = getRouteApi("/_protected");

export const Route = createFileRoute("/_protected/settings")({
  component: Settings,
});

// Settings page. LINE linking will go through better-auth LINE OAuth (LINE
// Login); until then the bot maps users via the LINE_USER_ID/PAYTAIL_USER_ID
// env pair, so there is nothing to configure here yet.
function Settings() {
  return (
    <div className={page.page}>
      <div className={page.container}>
        <div className={page.headerRow}>
          <h2 className={page.listTitle}>การตั้งค่า</h2>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          จดรายจ่ายผ่าน LINE บอท แล้วพิมพ์ข้อความเช่น "ปลาทู 40" เพื่อบันทึกรายการใช้จ่าย
        </p>
      </div>
    </div>
  );
}
