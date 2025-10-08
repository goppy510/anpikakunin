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
  notificationSettings?: {
    minIntensity: string | null;
    targetPrefectures: string[];
    notificationChannels: unknown;
    extraSettings: unknown;
    updatedAt: string;
  };
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

  let settingsRecord:
    | Prisma.SlackNotificationSettingGetPayload<{
        select: {
          minIntensity: true;
          targetPrefectures: true;
          notificationChannels: true;
          extraSettings: true;
          updatedAt: true;
        };
      }>
    | null
    | undefined = null;

  if (settings) {
    settingsRecord = await prisma.slackNotificationSetting.upsert({
      where: { workspaceRef: savedWorkspace.id },
      create: {
        workspaceRef: savedWorkspace.id,
        minIntensity: settings.minIntensity ?? null,
        targetPrefectures: settings.targetPrefectures ?? undefined,
        notificationChannels: settings.notificationChannels as Prisma.JsonValue,
        extraSettings: settings.extraSettings as Prisma.JsonValue,
      },
      update: {
        minIntensity: settings.minIntensity ?? null,
        targetPrefectures: settings.targetPrefectures ?? undefined,
        notificationChannels:
          (settings.notificationChannels as Prisma.JsonValue) ?? undefined,
        extraSettings:
          (settings.extraSettings as Prisma.JsonValue) ?? undefined,
      },
      select: {
        minIntensity: true,
        targetPrefectures: true,
        notificationChannels: true,
        extraSettings: true,
        updatedAt: true,
      },
    });
  }

  return {
    id: savedWorkspace.id,
    workspaceId: savedWorkspace.workspaceId,
    name: savedWorkspace.name,
    isEnabled: savedWorkspace.isEnabled,
    createdAt: savedWorkspace.createdAt.toISOString(),
    updatedAt: savedWorkspace.updatedAt.toISOString(),
    notificationSettings: settingsRecord
      ? {
          minIntensity: settingsRecord.minIntensity ?? null,
          targetPrefectures: settingsRecord.targetPrefectures ?? [],
          notificationChannels: settingsRecord.notificationChannels ?? null,
          extraSettings: settingsRecord.extraSettings ?? null,
          updatedAt: settingsRecord.updatedAt.toISOString(),
        }
      : undefined,
  };
};

export const listSlackWorkspaces = async (): Promise<SlackWorkspaceSummary[]> => {
  const rows = await prisma.slackWorkspace.findMany({
    include: { notificationSettings: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    notificationSettings: row.notificationSettings
      ? {
          minIntensity: row.notificationSettings.minIntensity ?? null,
          targetPrefectures: row.notificationSettings.targetPrefectures ?? [],
          notificationChannels: row.notificationSettings.notificationChannels,
          extraSettings: row.notificationSettings.extraSettings,
          updatedAt: row.notificationSettings.updatedAt.toISOString(),
        }
      : undefined,
  }));
};

export const getSlackBotToken = async (
  workspaceId: string
): Promise<string | null> => {
  const workspace = await prisma.slackWorkspace.findUnique({
    where: { workspaceId },
    select: {
      botTokenCiphertext: true,
      botTokenIv: true,
      botTokenTag: true,
    },
  });

  if (!workspace) return null;

  return decrypt({
    ciphertext: workspace.botTokenCiphertext,
    iv: workspace.botTokenIv,
    authTag: workspace.botTokenTag,
  });
};
