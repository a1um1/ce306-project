#!/usr/bin/env node
// Thin CLI over the native OCR binary (bin/slipreader). Reads KBank slips -> table | json | csv.
// Run: node cli.ts <image|dir>... [--json|--csv]
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface Party {
  name: string;
  bank?: string;
  channel?: string;
  accounts: string[];
}
interface Slip {
  file: string;
  type: string;
  transactionId: string;
  date: string;
  dateTime: string | null;
  amount: number;
  fee: number;
  currency: string;
  sender: Party;
  recipient: Party;
  durationMs: number;
}

const root = import.meta.dirname;
const bin = join(root, "bin", "slipreader");

const argv = process.argv.slice(2);
const paths: string[] = [];
let mode: "table" | "json" | "csv" = "table";
for (const a of argv) {
  if (a === "--json") mode = "json";
  else if (a === "--csv") mode = "csv";
  else if (a === "--table") mode = "table";
  else if (a === "-h" || a === "--help") {
    console.log("Usage: node cli.ts <image|dir>... [--table|--json|--csv]");
    console.log("Reads KBank slips. Highlight PNGs are written to ./highlight/.");
    process.exit(0);
  } else if (a.startsWith("-")) {
    console.error(`unknown flag: ${a}`);
    process.exit(2);
  } else paths.push(a);
}

if (paths.length === 0) {
  console.error("Usage: node cli.ts <image|dir>... [--table|--json|--csv]");
  process.exit(2);
}

if (!existsSync(bin)) {
  console.error("building bin/slipreader ...");
  const sources = [join(root, "main.swift"), ...readdirSync(join(root, "Sources")).filter((f) => f.endsWith(".swift")).map((f) => join(root, "Sources", f))];
  execFileSync("swiftc", ["-O", ...sources, "-o", bin], { stdio: "inherit" });
}

const t0 = performance.now();
const raw = execFileSync(bin, paths, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const elapsedMs = performance.now() - t0;
const slips: Slip[] = JSON.parse(raw);

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function printCsv(rows: Slip[]): void {
  const head = ["file", "type", "transactionId", "date", "dateTime", "amount", "fee", "currency", "sender", "recipient", "durationMs"];
  console.log(head.join(","));
  for (const s of rows) {
    console.log(
      [
        s.file,
        s.type,
        s.transactionId,
        s.date,
        s.dateTime ?? "",
        String(s.amount),
        String(s.fee),
        s.currency,
        s.sender.name,
        s.recipient.name,
        String(s.durationMs),
      ].map(csvField).join(","),
    );
  }
}

// count visible chars, not UTF-16 units, so Thai columns stay aligned
function printTable(rows: Slip[]): void {
  console.table(
    rows.map((s) => ({
      file: s.file,
      type: s.type,
      date: s.date,
      amount: s.amount.toFixed(2),
      fee: s.fee.toFixed(2),
      sender: s.sender.name,
      recipient: s.recipient.name,
      ms: s.durationMs.toFixed(0),
    })),
  );
  const total = rows.reduce((a, s) => a + s.amount, 0);
  console.log(`${rows.length} slips, total amount ${total.toFixed(2)} THB`);
}

if (mode === "json") console.log(JSON.stringify(slips, null, 2));
else if (mode === "csv") printCsv(slips);
else printTable(slips);

console.error(`read ${slips.length} slip(s) in ${elapsedMs.toFixed(0)} ms (${(elapsedMs / slips.length).toFixed(0)} ms/slip)`);
