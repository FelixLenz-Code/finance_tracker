import { iconResponse } from "@/lib/app-icon";

export function GET() {
  return iconResponse(512, { maskable: true });
}
