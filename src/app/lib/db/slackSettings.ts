import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db/prisma";
import { encrypt, decrypt } from "@/app/lib/security/encryption";

export type SlackWorkspaceInput = {
  workspaceId: string;
  name: string;
  botToken: string;
  isEnabled?: boolean;
};

export type SlackNotificationSettingsInput = {
  workspaceId: string;
  minIntensity?: string | null;
  targetPrefectures?: string[];
  notificationChannels?: unknown;
  extraSettings?: unknown;
};

export type SlackWorkspaceSummary = {
  id: string;
  workspaceId: string;
  name: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export const upsertSlackWorkspaceWithSettings = async (
  workspace: SlackWorkspaceInput,
  settings?: SlackNotificationSettingsInput
): Promise<SlackWorkspaceSummary> => {
  const encrypted = encrypt(workspace.botToken);

  const savedWorkspace = await prisma.slackWorkspace.upsert({
    where: { workspaceId: workspace.workspaceId },
    create: {
      workspaceId: workspace.workspaceId,
      name: workspace.name,
      botTokenCiphertext: encrypted.ciphertext,
      botTokenIv: encrypted.iv,
      botTokenTag: encrypted.authTag,
      isEnabled: workspace.isEnabled ?? true,
    },
    update: {
      name: workspace.name,
      botTokenCiphertext: encrypted.ciphertext,
      botTokenIv: encrypted.iv,
      botTokenTag: encrypted.authTag,
      isEnabled: workspace.isEnabled ?? true,
    },
  });

  // Note: settings parameter is deprecated - use EarthquakeNotificationCondition API instead

  return {
    id: savedWorkspace.id,
    workspaceId: savedWorkspace.workspaceId,
    name: savedWorkspace.name,
    isEnabled: savedWorkspace.isEnabled,
    createdAt: savedWorkspace.createdAt.toISOString(),
    updatedAt: savedWorkspace.updatedAt.toISOString(),
  };
};

export const listSlackWorkspaces = async (): Promise<SlackWorkspaceSummary[]> => {
  const rows = await prisma.slackWorkspace.findMany({
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
};

export const getSlackBotToken = async (
  workspaceId: string
): Promise<string | null> => {
  try {
    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
      select: {
        botTokenCiphertext: true,
        botTokenIv: true,
        botTokenTag: true,
      },
    });

    if (!workspace) {
      console.error(`Workspace not found: ${workspaceId}`);
      return null;
    }

    const decrypted = decrypt({
      ciphertext: workspace.botTokenCiphertext,
      iv: workspace.botTokenIv,
      authTag: workspace.botTokenTag,
    });

    return decrypted;
  } catch (error) {
    console.error(`Failed to decrypt bot token for workspace ${workspaceId}:`, error);
    return null;
  }
};
