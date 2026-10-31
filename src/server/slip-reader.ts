import { createHash } from "node:crypto";
import type { SlipRead } from "@/lib/api/types";
import { saveImportRead } from "./label-store";

async function readRemotely(baseUrl: string, dataUrls: string[]): Promise<(SlipRead | null)[]> {
  const token = process.env.SLIP_READER_TOKEN;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/read`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ dataUrls }),
  });
  if (!response.ok) throw new Error(`slip reader returned ${response.status}`);
  return (await response.json()) as (SlipRead | null)[];
}

// Every read the importer would accept is training data: nothing edited it, so
// the values are what the app used. Content-addressed so a re-read of the same
// photo updates one record instead of adding copies.
async function saveAccepted(dataUrls: string[], reads: (SlipRead | null)[]): Promise<void> {
  if (process.env.SLIP_SAVE_READS !== "1") return;
  await Promise.all(
    reads.map(async (read, index) => {
      if (!read || !(read.amount > 0) || !read.transactionId) return;
      const bytes = Buffer.from(dataUrls[index]?.split(",")[1] ?? "", "base64");
      if (bytes.length === 0) return;
      const name = `${createHash("sha1").update(bytes).digest("hex")}.jpg`;
      await saveImportRead(bytes, name, {
        ocrText: read.ocrText,
        predicted: {
          amount: String(read.amount),
          dateTime: read.dateTime ?? "",
          transactionId: read.transactionId,
          sender: read.sender,
          recipient: read.recipient,
        },
      }).catch((cause) => {
        // Saving is a side effect: never fail the read because of it.
        console.warn(`slip-reader: could not save ${name}`, cause);
      });
    }),
  );
}

// SLIP_READER_URL points at the OCR service (`pnpm slips:serve`). Unset, the
// macOS binary runs in-process, which is the zero-setup path for local dev.
export async function readSlipImages(dataUrls: string[]): Promise<(SlipRead | null)[]> {
  if (dataUrls.length === 0) return [];
  const remote = process.env.SLIP_READER_URL;
  const reads = remote ? await readRemotely(remote, dataUrls) : await readLocally(dataUrls);
  await saveAccepted(dataUrls, reads);
  return reads;
}
