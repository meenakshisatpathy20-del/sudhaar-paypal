import { NextResponse } from "next/server";
import { FlowError } from "./orders";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(e: unknown) {
  const status = e instanceof FlowError ? e.status : 500;
  const message = e instanceof Error ? e.message : String(e);
  if (status >= 500) console.error(e);
  return NextResponse.json({ error: message }, { status });
}
