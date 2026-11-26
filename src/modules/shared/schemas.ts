import { z } from "zod";

export const signedUrlSchema = z.object({
  bucket: z.enum(["request-documents", "signatures", "payment-receipts", "identity-documents"]),
  path: z.string().trim().min(1),
});
