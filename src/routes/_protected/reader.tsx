import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import page from "@/components/layout/page.module.css";
import { listCategories } from "@/lib/api/categories";
import { readSlips } from "@/lib/api/slips";
import type { SlipRead } from "@/lib/api/types";
import { formatAmount, formatThaiDate } from "@/lib/utils/format";
import { prepareUploads } from "@/lib/utils/read-slip";
import styles from "./reader.module.css";

const parent = getRouteApi("/_protected");

type Row = {
  name: string;
  preview: string;
  payload: string | null;
  read: SlipRead | null;
};

export const Route = createFileRoute("/_protected/reader")({
  loader: async () => ({ categories: await listCategories() }),
  component: SlipTest,
});

// Debug surface for the native reader: upload slips, see the fields the model
// returned. Nothing here writes to the database.
function SlipTest() {
  const { user } = parent.useRouteContext();
  const { categories } = Route.useLoaderData();
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const previews = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const url of previews.current) URL.revokeObjectURL(url);
    };
  }, []);

  const run = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      setError("เลือกไฟล์รูปภาพ");
      return;
    }

    setBusy(true);
    setError(null);
    setElapsed(null);
    for (const url of previews.current) URL.revokeObjectURL(url);
    previews.current = images.map((file) => URL.createObjectURL(file));
    setRows([]);

    try {
      const uploads = await prepareUploads(images);
      const started = performance.now();
      const reads = await readSlips(uploads.map((upload) => upload.data));
      setElapsed(performance.now() - started);
      setRows(
        uploads.map((upload, index) => ({
          name: upload.name,
          preview: previews.current[index],
          payload: upload.payload,
          read: reads[index] ?? null,
        })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "อ่านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const read = rows.filter((row) => row.read).length;

  return (
    <div className={page.page}>
      <AppHeader user={user} categories={categories} onChanged={() => void router.invalidate()} />

      <div className={page.container}>
        <div className={page.headerRow}>
          <h2 className={page.listTitle}>ทดสอบอ่านสลิป</h2>
        </div>

        <label className={busy ? styles.dropzoneBusy : styles.dropzone}>
          {busy ? "กำลังอ่าน…" : "เลือกไฟล์สลิป (เลือกหลายไฟล์ได้)"}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void run(files);
            }}
          />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}
        {elapsed !== null && rows.length > 0 ? (
          <span className={styles.meta}>
            อ่านได้ {read}/{rows.length} สลิป · {(elapsed / 1000).toFixed(1)} วินาที ·{" "}
            {Math.round(elapsed / rows.length)} ms/สลิป
          </span>
        ) : null}

        <div className={styles.results}>
          {rows.map((row) => (
            <article key={row.preview} className={styles.card}>
              <a href={row.preview} target="_blank" rel="noopener noreferrer">
                <img src={row.preview} alt="" className={styles.thumb} />
              </a>
              <div className={styles.body}>
                <span className={styles.file}>{row.name}</span>

                {row.read ? (
                  <dl className={styles.fields}>
                    <div>
                      <dt>จำนวนเงิน</dt>
                      <dd>{formatAmount(row.read.amount)}</dd>
                    </div>
                    <div>
                      <dt>วันที่</dt>
                      <dd>{row.read.dateTime ? formatThaiDate(row.read.dateTime) : "—"}</dd>
                    </div>
                    <div>
                      <dt>เลขที่รายการ</dt>
                      <dd>{row.read.transactionId || "—"}</dd>
                    </div>
                    <div>
                      <dt>ผู้รับ</dt>
                      <dd>{row.read.recipient.name || "—"}</dd>
                    </div>
                  </dl>
                ) : (
                  <span className={styles.failed}>อ่านไม่ได้</span>
                )}

                {row.read ? (
                  <details className={styles.json}>
                    <summary>JSON</summary>
                    <pre>{JSON.stringify(row.read, null, 2)}</pre>
                  </details>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
