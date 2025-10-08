import { NextResponse } from "next/server";
import { logEarthquakeEvent } from "@/app/lib/db/earthquakeEvents";
import type { EventItem } from "@/app/components/monitor/types/EventItem";

type RequestBody = {
  event: EventItem;
  source: "rest" | "websocket";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RequestBody>;

    if (!body?.event || !body?.source) {
      return NextResponse.json(
        { error: "event and source are required" },
        { status: 400 }
      );
    }

    const { inserted } = await logEarthquakeEvent(body.event, body.source);

    return NextResponse.json({ inserted });
  } catch (error) {
    console.error("Failed to store earthquake event log:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
