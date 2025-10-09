import { type EventItem } from "@/app/components/monitor/types/EventItem";
import crypto from "crypto";
import { prisma } from "@/app/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type EventLogSource = "rest" | "websocket";

type LogResult = {
  inserted: boolean;
};

const hashEvent = (event: EventItem): string => {
  const serialized = JSON.stringify(event);
  return crypto.createHash("sha256").update(serialized).digest("hex");
};

export const logEarthquakeEvent = async (
  event: EventItem,
  source: EventLogSource
): Promise<LogResult> => {
  const payloadHash = hashEvent(event);

  try {
    await prisma.earthquakeEventLog.create({
      data: {
        eventId: event.eventId,
        payloadHash,
        source,
        payload: event,
        fetchedAt: event.arrivalTime
          ? new Date(event.arrivalTime)
          : undefined,
      },
    });
    return { inserted: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { inserted: false };
    }
    throw error;
  }
};
