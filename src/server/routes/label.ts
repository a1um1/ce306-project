// Labeling tool API: lists the local slip corpus, runs the current reader on it,
// and stores human-corrected fields for training. Local-only by nature: it reads
// and writes files under tools/slip-reader/.
import { Hono } from "hono";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { requireUser } from "../auth-context";
import {
  DATA_DIR,
  LABELS_FILE,
  imageMime,
  loadLabels,
  listSlipFiles,
  resolveSlip,
  saveLabels,
  type LabelRecord,
  type SlipFile,
  type SlipLabel,
} from "../label-store";
import { SlipRead } from "@/lib/api/types";

export const labelRoutes = new Hono();

// labelRoutes.use("*", async (c, next) => {
//   await requireUser(c);
//   await next();
// });

// labelRoutes.get("/slips", async (c) => {
//   const [files, labels] = await Promise.all([listSlipFiles(), loadLabels()]);
//   return c.json({
//     files: files.map((file) => ({ ...file, record: labels.get(file.path) ?? null })),
//     labelsFile: LABELS_FILE,
//   });
// });

// labelRoutes.get("/image", async (c) => {
//   const slip = resolveSlip(c.req.query("path") ?? "");
//   if (!slip) return c.json({ error: "Not found" }, 404);
//   try {
//     const buffer = await readFile(slip.abs);
//     const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
//     return c.body(body as ArrayBuffer, 200, {
//       "content-type": slip.mime,
//       "cache-control": "private, max-age=600",
//     });
//   } catch {
//     return c.json({ error: "Not found" }, 404);
//   }
// });

// function toLabel(row: SlipRead): SlipLabel {
//   return {
//     amount: String(row.amount ?? ""),
//     dateTime: row.dateTime ?? "",
//     transactionId: row.transactionId ?? "",
//     sender: row.sender ?? "",
//     recipient: row.recipient ?? "",
//   };
// }

// labelRoutes.post("/run", async (c) => {
//   const payload = await c.req.json<{ paths?: unknown }>().catch(() => ({ paths: [] }));
//   const paths = Array.isArray(payload.paths)
//     ? payload.paths.filter((path): path is string => typeof path === "string")
//     : [];
//   const targets = paths.map((path) => ({ path, slip: resolveSlip(path) }));
//   const rows = await readSlipFiles(
//     targets.flatMap((target) => (target.slip ? [target.slip.abs] : [])),
//   );
//   // shortcut: rows are matched by file name, so two dirs with the same image name
//   // collide. Fine for the current corpus; key by index if that ever happens.
//   const byName = new Map(rows.map((row) => [row.file ?? "", row]));

//   return c.json({
//     results: targets.map((target) => {
//       const row = target.slip ? byName.get(basename(target.path)) : undefined;
//       return {
//         path: target.path,
//         ok: Boolean(row?.raw),
//         ocrText: row?.raw ?? "",
//         predicted: row ? toLabel(row) : null,
//       };
//     }),
//   });
// });

// function cleanLabel(value: unknown): SlipLabel {
//   const label = (value ?? {}) as Record<string, unknown>;
//   const text = (key: string) => (typeof label[key] === "string" ? (label[key] as string) : "");
//   return {
//     amount: text("amount"),
//     dateTime: text("dateTime"),
//     transactionId: text("transactionId"),
//     sender: text("sender"),
//     recipient: text("recipient"),
//   };
// }

// labelRoutes.post("/save", async (c) => {
//   const payload = await c.req.json<{ records?: unknown }>().catch(() => ({ records: [] }));
//   const now = new Date().toISOString();
//   const records: LabelRecord[] = [];

//   for (const value of Array.isArray(payload.records) ? payload.records : []) {
//     const raw = value as Partial<LabelRecord>;
//     if (typeof raw.path !== "string" || !raw.label || !resolveSlip(raw.path)) continue;
//     records.push({
//       path: raw.path,
//       ocrText: typeof raw.ocrText === "string" ? raw.ocrText : "",
//       predicted: cleanLabel(raw.predicted),
//       label: cleanLabel(raw.label),
//       updatedAt: now,
//     });
//   }

//   return c.json({ saved: await saveLabels(records) });
// });

// labelRoutes.post("/upload", async (c) => {
//   const form = await c.req.formData();
//   const uploads = form
//     .getAll("files")
//     .filter((value): value is File => typeof value !== "string" && value.size > 0);

//   const dir = join(DATA_DIR, "uploads");
//   await mkdir(dir, { recursive: true });
//   const files: SlipFile[] = [];

//   for (const [index, file] of uploads.entries()) {
//     const ext = extname(file.name).toLowerCase();
//     if (!imageMime(file.name)) continue;
//     const safe = basename(file.name, extname(file.name)).replace(/[^\w .()-]/g, "_") || "slip";
//     const name = `${Date.now()}-${index}-${safe}${ext}`;
//     await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
//     files.push({ path: `uploads/${name}`, name, bank: "uploads" });
//   }

//   return c.json({ files });
// });
