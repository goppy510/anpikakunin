import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  DeleteRuleCommand,
  RemoveTargetsCommand,
} from "@aws-sdk/client-eventbridge";

/**
 * EventBridge Rule作成用ヘルパー関数
 */

export interface CreateTrainingRuleParams {
  trainingId: string;
  scheduledAt: Date; // 訓練実行日時（JST）
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  apiDestinationArn: string;
  roleArn: string;
}

/**
 * 訓練モード用のEventBridge Ruleを作成
 */
export async function createTrainingRule(
  params: CreateTrainingRuleParams
): Promise<{ ruleName: string; ruleArn: string }> {
  const {
    trainingId,
    scheduledAt,
    accessKeyId,
    secretAccessKey,
    region,
    apiDestinationArn,
    roleArn,
  } = params;

  const client = new EventBridgeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const ruleName = `training-${trainingId}`;

  // scheduledAtは既にフロントエンドでUTC変換済み（toISOString()）
  // そのままUTCとして使用
  const minute = scheduledAt.getUTCMinutes();
  const hour = scheduledAt.getUTCHours();
  const dayOfMonth = scheduledAt.getUTCDate();
  const month = scheduledAt.getUTCMonth() + 1; // 0-indexed
  const year = scheduledAt.getUTCFullYear();

  // Cron式を生成（1回限りの実行）
  // 形式: cron(分 時 日 月 ? 年)
  const cronExpression = `cron(${minute} ${hour} ${dayOfMonth} ${month} ? ${year})`;

  try {
    // 1. Ruleを作成
    const putRuleCommand = new PutRuleCommand({
      Name: ruleName,
      Description: `訓練通知 - ${scheduledAt.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      })}`,
      ScheduleExpression: cronExpression,
      State: "ENABLED",
      EventBusName: "default",
    });

    const ruleResponse = await client.send(putRuleCommand);

    if (!ruleResponse.RuleArn) {
      throw new Error("Rule ARN not returned");
    }

    // 2. Targetを設定（API Destination）
    const putTargetsCommand = new PutTargetsCommand({
      Rule: ruleName,
      EventBusName: "default",
      Targets: [
        {
          Id: "1",
          Arn: apiDestinationArn,
          RoleArn: roleArn,
          HttpParameters: {
            HeaderParameters: {},
            QueryStringParameters: {},
          },
          Input: JSON.stringify({
            trainingId,
          }),
          RetryPolicy: {
            MaximumRetryAttempts: 2,
            MaximumEventAgeInSeconds: 3600, // 1時間
          },
        },
      ],
    });

    await client.send(putTargetsCommand);

    return {
      ruleName,
      ruleArn: ruleResponse.RuleArn,
    };
  } catch (error) {
    console.error("Failed to create EventBridge Rule:", error);
    throw error;
  }
}

/**
 * 訓練モード用のEventBridge Ruleを削除
 */
export async function deleteTrainingRule(params: {
  trainingId: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}): Promise<void> {
  const { trainingId, accessKeyId, secretAccessKey, region } = params;

  const client = new EventBridgeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const ruleName = `training-${trainingId}`;

  try {
    // 1. Targetを削除
    const removeTargetsCommand = new RemoveTargetsCommand({
      Rule: ruleName,
      EventBusName: "default",
      Ids: ["1"],
    });

    await client.send(removeTargetsCommand);

    // 2. Ruleを削除
    const deleteRuleCommand = new DeleteRuleCommand({
      Name: ruleName,
      EventBusName: "default",
    });

    await client.send(deleteRuleCommand);
  } catch (error) {
    console.error("Failed to delete EventBridge Rule:", error);
    throw error;
  }
}
