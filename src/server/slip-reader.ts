import { createHash } from "node:crypto";
import type { SlipRead } from "@/lib/api/types";
import { saveImportRead } from "./label-store";

async function readRemotely(fileUrl: string): Promise<SlipRead | null> {
  const token = process.env.SLIP_READER_TOKEN;
  const baseUrl = process.env.SLIP_READER_URL;

  if (!baseUrl) throw new Error("Slip service are not available");
  const buffer = Buffer.from(fileUrl.split(",")[1] ?? "", "base64");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/slip`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: buffer,
  });
  if (!response.ok) throw new Error(`slip reader returned ${response.status}`);
  return (await response.json()) as SlipRead | null;
}

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
          sender: read.sender.name,
          recipient: read.recipient.name,
        },
      }).catch((cause) => {
        console.warn(`slip-reader: could not save ${name}`, cause);
      });
    }),
  );
}

export async function readSlipImages(dataUrls: string[]): Promise<(SlipRead | null)[]> {
  if (dataUrls.length === 0) return [];
  const reads = [] as (SlipRead | null)[];
  for (const url of dataUrls) {
    console.log(`slip-reader: reading ${url.slice(0, 30)}...`);
    const result = await readRemotely(url);
    reads.push(result);
  }
  console.log(reads);
  await saveAccepted(dataUrls, reads);
  return reads;
}
