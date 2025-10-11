import { prisma } from "@/app/lib/db/prisma";
import { NextRequest } from "next/server";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "connected"
  | "disconnected"
  | "enabled"
  | "disabled"
  | "invited"
  | "login"
  | "logout";

export type ResourceType =
  | "workspace"
  | "department"
  | "user"
  | "group"
  | "condition"
  | "channel"
  | "message_template"
  | "earthquake"
  | "notification";

export interface ActivityLogData {
  userId?: string;
  userEmail: string;
  action: ActivityAction;
  resourceType: ResourceType;
  resourceId?: string;
  resourceName?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * アクティビティログを記録
 */
export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        resourceName: data.resourceName,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // アクティビティログの失敗でメイン処理を止めない
  }
}

/**
 * NextRequestからIPアドレスとUser-Agentを取得
 */
export function getRequestInfo(request: NextRequest): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}

/**
 * アクティビティログを取得（ページネーション対応）
 */
export async function getActivityLogs(options?: {
  limit?: number;
  offset?: number;
  userId?: string;
  resourceType?: ResourceType;
  action?: ActivityAction;
}) {
  const {
    limit = 20,
    offset = 0,
    userId,
    resourceType,
    action,
  } = options || {};

  const where: any = {};

  if (userId) {
    where.userId = userId;
  }

  if (resourceType) {
    where.resourceType = resourceType;
  }

  if (action) {
    where.action = action;
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs,
    total,
    hasMore: offset + limit < total,
  };
}
