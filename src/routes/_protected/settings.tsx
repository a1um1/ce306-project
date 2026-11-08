import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import page from "@/components/layout/page.module.css";
import {
  botAddFriendUrl,
  createLinkCode,
  getLinkCode,
  getLinkStatus,
  unlinkLine,
} from "@/lib/api/line";

const parent = getRouteApi("/_protected");

export const Route = createFileRoute("/_protected/settings")({
  component: Settings,
});

type ActiveCode = { code: string; expiresAt: number } | null;

// Settings page: account-level controls. This section ("เชื่อมต่อ LINE") links
// a LINE account to this PayTail account so the bot can book expenses.
function Settings() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [basicId, setBasicId] = useState<string | null>(null);
  const [code, setCode] = useState<ActiveCode>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getLinkStatus(), getLinkCode().catch(() => null)]).then(
      ([status, active]) => {
        setLinked(status.linked);
        setBasicId(status.basicId);
        setCode(active ? { code: active.code, expiresAt: +new Date(active.expiresAt) } : null);
      },
    );
  }, []);

  // Count down while a code is active.
  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);

  // Drop the code from the UI when it expires, so the button comes back.
  useEffect(() => {
    if (code && now >= code.expiresAt) setCode(null);
  }, [now, code]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createLinkCode();
      setCode({ code: created.code, expiresAt: +new Date(created.expiresAt) });
      setNow(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "สร้างรหัสไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm("ยกเลิกการเชื่อมต่อ LINE หรือไม่?")) return;
    setBusy(true);
    setError(null);
    try {
      await unlinkLine();
      setLinked(false);
      setCode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const secondsLeft = code ? Math.max(0, Math.ceil((code.expiresAt - now) / 1000)) : 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const friendUrl = basicId ? botAddFriendUrl(basicId) : null;

  return (
    <div className={page.page}>
      <div className={page.container}>
        <div className={page.headerRow}>
          <h2 className={page.listTitle}>การตั้งค่า</h2>
        </div>

        <section style={{ boxShadow: "none" }}>
          <h3 style={{ margin: "16px 0 6px", fontSize: 18, fontWeight: 600 }}>เชื่อมต่อ LINE</h3>
          <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 14 }}>
            จดรายจ่ายผ่านบอทใน LINE แล้วซิงก์เข้า PayTail อัตโนมัติ
          </p>

          {error ? (
            <p style={{ color: "var(--danger)", margin: "0 0 12px" }}>{error}</p>
          ) : null}

          {linked === false || linked === null ? (
            <div>
              {code ? (
                <div>
                  <p style={{ margin: "4px 0" }}>รหัสเชื่อมต่อของคุณ:</p>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      letterSpacing: 6,
                      background: "var(--surface)",
                      border: "2px dashed var(--border)",
                      borderRadius: 12,
                      padding: "14px 0",
                      textAlign: "center",
                      margin: "8px 0",
                    }}
                  >
                    {code.code}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 14, margin: "4px 0" }}>
                    หมดอายุใน {mm}:{ss} นาที &nbsp;·&nbsp; ส่งรหัสนี้ให้บอทใน LINE
                  </p>
                  <p style={{ fontSize: 13, margin: "2px 0" }}>
                    เปิด <a href={friendUrl ?? "#"} target="_blank" rel="noopener noreferrer">LINE</a>{" "}
                    พิมพ์รหัสด้านบน แล้วอีก 1 ข้อความก็เชื่อมต่อเสร็จ
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <Button variant="outline" size="sm" onClick={create} disabled={busy}>
                      สร้างรหัสใหม่
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ margin: "4px 0", fontSize: 14 }}>
                    {friendUrl ? (
                      <>
                        เพิ่มเพื่อนใน <a href={friendUrl} target="_blank" rel="noopener noreferrer">บอท LINE</a>{" "}
                        จากนั้นสร้างรหัสเชื่อมต่อ นำไปส่งให้บอทเพื่อจับคู่บัญชี
                      </>
                    ) : null}
                  </p>
                  <Button size="md" onClick={create} disabled={busy || linked === null}>
                    สร้างรหัสเชื่อมต่อ
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p style={{ margin: "4px 0", fontSize: 14 }}>
                เชื่อมต่อ LINE แล้ว ✅ พิมพ์ข้อความเช่น "ปลาทู 40" ไปที่บอทเพื่อจดรายจ่าย
              </p>
              <Button variant="outline" size="sm" onClick={unlink} disabled={busy}>
                ยกเลิกการเชื่อมต่อ
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
