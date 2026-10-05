import { NextResponse } from "next/server";
import type { z } from "zod";

// Turns a zod failure into one readable sentence, e.g.
// "days.0.signInEnd: Sign-in must end after it starts."
export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

// Parses a JSON request body against a schema, returning either the data or
// a 400 response to return as-is.
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "Request body must be JSON." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 }) };
  }
  return { data: parsed.data };
}
