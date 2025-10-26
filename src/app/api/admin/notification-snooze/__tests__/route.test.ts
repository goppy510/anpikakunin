/**
 * 通知スヌーズAPIのテスト
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../route';
import { prisma } from '@/app/lib/db/prisma';
import { requireAuth } from '@/app/lib/auth/middleware';

// モック設定
jest.mock('@/app/lib/auth/middleware');
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

// テスト用データのクリーンアップヘルパー
async function cleanupTestData() {
  await prisma.notificationSnooze.deleteMany({});
  await prisma.notificationSnoozeConfig.deleteMany({});
  await prisma.slackWorkspace.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
}

describe('通知スヌーズAPI', () => {
  let testUser: any;
  let testWorkspace: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanupTestData();

    // テストユーザー作成
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: 'hashed',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
      },
    });

    // テストワークスペース作成
    testWorkspace = await prisma.slackWorkspace.create({
      data: {
        workspaceId: 'T12345',
        name: 'テストワークスペース',
        botTokenCiphertext: 'encrypted',
        botTokenIv: 'iv',
        botTokenTag: 'tag',
      },
    });

    // requireAuth モック設定
    mockedRequireAuth.mockResolvedValue({ user: testUser });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('GET - スヌーズ状態取得', () => {
    it('スヌーズが有効な場合、状態を返す', async () => {
      // スヌーズを作成
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.notificationSnooze.create({
        data: {
          workspaceRef: testWorkspace.id,
          snoozedBy: testUser.id,
          expiresAt,
        },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/notification-snooze?workspaceRef=${testWorkspace.id}`
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.snoozed).toBe(true);
      expect(data.snooze).toBeDefined();
      expect(data.snooze.snoozedBy).toBe(testUser.id);
    });

    it('スヌーズが無効な場合、falseを返す', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/admin/notification-snooze?workspaceRef=${testWorkspace.id}`
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.snoozed).toBe(false);
    });

    it('期限切れスヌーズは自動削除される', async () => {
      // 期限切れスヌーズを作成
      const expiresAt = new Date(Date.now() - 1000); // 1秒前
      await prisma.notificationSnooze.create({
        data: {
          workspaceRef: testWorkspace.id,
          snoozedBy: testUser.id,
          expiresAt,
        },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/notification-snooze?workspaceRef=${testWorkspace.id}`
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.snoozed).toBe(false);

      // スヌーズが削除されたことを確認
      const snooze = await prisma.notificationSnooze.findUnique({
        where: { workspaceRef: testWorkspace.id },
      });
      expect(snooze).toBeNull();
    });

    it('workspaceRefがない場合は400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze'
      );

      const response = await GET(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('workspaceRef is required');
    });
  });

  describe('POST - スヌーズ実行', () => {
    it('デフォルト24時間でスヌーズを作成', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze',
        {
          method: 'POST',
          body: JSON.stringify({ workspaceRef: testWorkspace.id }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.snooze).toBeDefined();
      expect(data.snooze.snoozedBy).toBe(testUser.id);

      // スヌーズが作成されたことを確認
      const snooze = await prisma.notificationSnooze.findUnique({
        where: { workspaceRef: testWorkspace.id },
      });
      expect(snooze).not.toBeNull();
      expect(snooze!.snoozedBy).toBe(testUser.id);

      // 有効期限が約24時間後であることを確認（誤差1分許容）
      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(snooze!.expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000); // 1分以内の誤差
    });

    it('設定された時間でスヌーズを作成', async () => {
      // スヌーズ設定を作成（48時間）
      await prisma.notificationSnoozeConfig.create({
        data: {
          workspaceRef: testWorkspace.id,
          durationHours: 48,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze',
        {
          method: 'POST',
          body: JSON.stringify({ workspaceRef: testWorkspace.id }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      const snooze = await prisma.notificationSnooze.findUnique({
        where: { workspaceRef: testWorkspace.id },
      });
      expect(snooze).not.toBeNull();

      // 有効期限が約48時間後であることを確認
      const expectedExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const timeDiff = Math.abs(snooze!.expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(60 * 1000);
    });

    it('既存のスヌーズを更新', async () => {
      // 既存スヌーズを作成
      const oldExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await prisma.notificationSnooze.create({
        data: {
          workspaceRef: testWorkspace.id,
          snoozedBy: testUser.id,
          expiresAt: oldExpiresAt,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze',
        {
          method: 'POST',
          body: JSON.stringify({ workspaceRef: testWorkspace.id }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      const snooze = await prisma.notificationSnooze.findUnique({
        where: { workspaceRef: testWorkspace.id },
      });
      expect(snooze).not.toBeNull();

      // 有効期限が更新されていることを確認
      expect(snooze!.expiresAt.getTime()).toBeGreaterThan(oldExpiresAt.getTime());
    });

    it('workspaceRefがない場合は400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('存在しないワークスペースの場合は404を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze',
        {
          method: 'POST',
          body: JSON.stringify({ workspaceRef: 'non-existent-id' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE - スヌーズ解除', () => {
    it('スヌーズを削除', async () => {
      // スヌーズを作成
      await prisma.notificationSnooze.create({
        data: {
          workspaceRef: testWorkspace.id,
          snoozedBy: testUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/notification-snooze?workspaceRef=${testWorkspace.id}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      // スヌーズが削除されたことを確認
      const snooze = await prisma.notificationSnooze.findUnique({
        where: { workspaceRef: testWorkspace.id },
      });
      expect(snooze).toBeNull();
    });

    it('スヌーズが存在しない場合でも成功を返す', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/admin/notification-snooze?workspaceRef=${testWorkspace.id}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('workspaceRefがない場合は400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze',
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      expect(response.status).toBe(400);
    });
  });
});
