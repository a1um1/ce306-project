import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import {
  listSlips,
  runSlips,
  saveLabelRecords,
  slipImageUrl,
  uploadSlips,
  type LabelFile,
  type RunResult,
  type SlipLabel,
} from "@/lib/api/label";
import styles from "./label.module.css";

export const Route = createFileRoute("/_protected/label")({
  component: LabelPage,
});

const EMPTY: SlipLabel = { amount: "", dateTime: "", transactionId: "", sender: "", recipient: "" };

const FIELDS: { key: keyof SlipLabel; label: string }[] = [
  { key: "amount", label: "จำนวนเงิน" },
  { key: "dateTime", label: "วันที่ (ISO)" },
  { key: "transactionId", label: "เลขที่รายการ" },
  { key: "sender", label: "ผู้ส่ง" },
  { key: "recipient", label: "ผู้รับ" },
];

type Row = LabelFile & {
  ocrText: string;
  predicted: SlipLabel | null;
  label: SlipLabel;
  saved: boolean;
  dirty: boolean;
  failed: boolean;
};

function toRow(file: LabelFile): Row {
  return {
    ...file,
    ocrText: file.record?.ocrText ?? "",
    predicted: file.record?.predicted ?? null,
    label: file.record?.label ?? file.record?.predicted ?? EMPTY,
    saved: Boolean(file.record?.label),
    dirty: false,
    failed: false,
  };
}

const CHUNK = 4;

// Local training-data workbench: run the current reader over the corpus, correct
// the fields by hand, save each slip to training/labels.jsonl.
function LabelPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [labelsFile, setLabelsFile] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<"run" | "save" | "upload" | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listSlips()
      .then(({ files, labelsFile }) => {
        setRows(files.map(toRow));
        setLabelsFile(labelsFile);
        setSelected(files[0]?.path ?? null);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "โหลดรายการไม่สำเร็จ"));
  }, []);

  const dirtyCount = useMemo(() => rows.filter((row) => row.dirty).length, [rows]);
  const missing = useMemo(() => rows.filter((row) => !row.ocrText).length, [rows]);
  const savedCount = useMemo(() => rows.filter((row) => row.saved).length, [rows]);
  // A read that was never stored still needs saving: "อ่านใหม่" fills the fields
  // without making the row dirty.
  const needsSave = (row: Row) => row.dirty || (!row.saved && Boolean(row.ocrText || row.predicted));
  const todoCount = useMemo(() => rows.filter(needsSave).length, [rows]);
  const current = rows.find((row) => row.path === selected) ?? null;

  useEffect(() => {
    if (dirtyCount === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const applyResults = (results: RunResult[]) => {
    setRows((prev) =>
      prev.map((row) => {
        const hit = results.find((result) => result.path === row.path);
        if (!hit) return row;
        const label = !row.saved && !row.dirty && hit.predicted ? hit.predicted : row.label;
        return {
          ...row,
          ocrText: hit.ocrText || row.ocrText,
          predicted: hit.predicted ?? row.predicted,
          label,
          failed: !hit.ok,
        };
      }),
    );
  };

  const run = async (paths: string[]) => {
    if (paths.length === 0 || busy) return;
    setBusy("run");
    setError(null);
    setProgress([0, paths.length]);
    try {
      for (let index = 0; index < paths.length; index += CHUNK) {
        const { results } = await runSlips(paths.slice(index, index + CHUNK));
        applyResults(results);
        setProgress([Math.min(index + CHUNK, paths.length), paths.length]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "อ่านสลิปไม่สำเร็จ");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const persist = async (targets: Row[]) => {
    if (targets.length === 0) return true;
    setBusy("save");
    setError(null);
    try {
      await saveLabelRecords(
        targets.map((row) => ({
          path: row.path,
          ocrText: row.ocrText,
          predicted: row.predicted,
          label: row.label,
        })),
      );
      const paths = new Set(targets.map((row) => row.path));
      setRows((prev) =>
        prev.map((row) => (paths.has(row.path) ? { ...row, saved: true, dirty: false } : row)),
      );
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveAndNext = async () => {
    if (!current) return;
    const saved = needsSave(current) ? await persist([current]) : true;
    if (!saved) return;
    const index = rows.findIndex((row) => row.path === current.path);
    const next = rows[index + 1] ?? null;
    setSelected(next?.path ?? current.path);
  };

  const edit = (key: keyof SlipLabel, value: string) => {
    if (!current) return;
    setRows((prev) =>
      prev.map((row) =>
        row.path === current.path
          ? { ...row, label: { ...row.label, [key]: value }, dirty: true }
          : row,
      ),
    );
  };

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy("upload");
    setError(null);
    try {
      const { files: added } = await uploadSlips(files);
      setRows((prev) => [
        ...prev,
        ...added.filter((file) => !prev.some((row) => row.path === file.path)).map(toRow),
      ]);
      if (!selected && added[0]) setSelected(added[0].path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "อัพโหลดไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const status = (row: Row) =>
    row.dirty
      ? "dirty"
      : row.saved
        ? "saved"
        : row.failed
          ? "failed"
          : row.predicted
            ? "predicted"
            : "new";

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Label สลิป</h1>
          <p className={styles.sub}>
            บันทึกแล้ว {savedCount}/{rows.length} · รอแก้ {dirtyCount} · {labelsFile}
          </p>
        </div>
        <div className={styles.actions}>
          <ButtonLink
            to="/"
            search={{ range: "today", year: new Date().getFullYear() }}
            variant="secondary"
            size="sm"
          >
            หน้าหลัก
          </ButtonLink>
          <label className={busy ? styles.uploadDisabled : styles.upload}>
            เพิ่มสลิป
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={Boolean(busy)}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void upload(files);
              }}
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(busy) || missing === 0}
            onClick={() => void run(rows.filter((row) => !row.ocrText).map((row) => row.path))}
          >
            {busy === "run" && progress
              ? `กำลังอ่าน ${progress[0]}/${progress[1]}`
              : `อ่านที่ยังไม่มี (${missing})`}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(busy) || rows.length === 0}
            onClick={() => void run(rows.map((row) => row.path))}
          >
            อ่านใหม่ทั้งหมด
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={Boolean(busy) || todoCount === 0}
            onClick={() => void persist(rows.filter(needsSave))}
          >
            บันทึก ({todoCount})
          </Button>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.layout}>
        <nav className={styles.list}>
          {rows.map((row) => (
            <button
              key={row.path}
              type="button"
              className={row.path === selected ? styles.itemActive : styles.item}
              onClick={() => setSelected(row.path)}
            >
              <img
                src={slipImageUrl(row.path)}
                alt=""
                className={styles.thumb}
                loading="lazy"
                crossOrigin="use-credentials"
              />
              <span className={styles.itemBody}>
                <span className={styles.itemName}>{row.name}</span>
                <span className={styles.itemMeta}>{row.bank}</span>
              </span>
              <span className={styles.dot} data-state={status(row)} />
            </button>
          ))}
          {rows.length === 0 ? (
            <p className={styles.empty}>ไม่พบสลิปใน tools/slip-reader/data</p>
          ) : null}
        </nav>

        <section className={styles.editor}>
          {current ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 12,
                  minHeight: 0,
                  minWidth: 0,
                }}
              >
                <a href={slipImageUrl(current.path)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={slipImageUrl(current.path)}
                    alt={current.name}
                    className={styles.image}
                    crossOrigin="use-credentials"
                  />
                </a>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div className={styles.form}>
                    {FIELDS.map((field) => (
                      <div key={field.key} className={styles.field}>
                        <Input
                          size="sm"
                          label={field.label}
                          value={current.label[field.key]}
                          onChange={(event) => edit(field.key, event.target.value)}
                          inputMode={field.key === "amount" ? "decimal" : undefined}
                        />
                        {current.predicted &&
                        current.predicted[field.key] !== current.label[field.key] ? (
                          <span className={styles.predicted}>
                            AI: {current.predicted[field.key] || "—"}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <details className={styles.ocr}>
                    <summary>ข้อความ OCR ({current.ocrText.length} ตัวอักษร)</summary>
                    <pre>{current.ocrText || "—"}</pre>
                  </details>
                </div>
              </div>

              <div className={styles.footer}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={Boolean(busy)}
                  onClick={() => void run([current.path])}
                >
                  อ่านใหม่
                </Button>
                <span className={styles.file}>{current.path}</span>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={Boolean(busy)}
                  onClick={() => void saveAndNext()}
                >
                  บันทึก + ถัดไป
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.empty}>เลือกสลิปจากรายการซ้าย</p>
          )}
        </section>
      </div>
    </div>
  );
}
