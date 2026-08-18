import type { ToolContext } from "@lovable.dev/mcp-js";
import { fail } from "./helpers";

/** Subscriptions were discontinued — every observer has the full feature set. */
export async function isPlusActive(_ctx: ToolContext): Promise<boolean> {
  return true;
}

export function plusRequired() {
  return fail("This feature is currently unavailable. Contact j44soft@gmail.com.");
}
