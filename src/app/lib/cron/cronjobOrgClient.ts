// cron-job.org REST API Client
import { env } from "@/app/lib/env";
import { getCronJobApiKey } from "./cronjobApiKey";

const CRONJOB_API_BASE = "https://api.cron-job.org";

interface CronJobSchedule {
  hours: number[]; // 0-23, -1 for all
  mdays: number[]; // 1-31, -1 for all
  minutes: number[]; // 0-59, -1 for all
  months: number[]; // 1-12, -1 for all
  wdays: number[]; // 0-6 (0=Sunday), -1 for all
  timezone: string; // e.g., "Asia/Tokyo"
  expiresAt?: number; // YYYYMMDDhhmmss format for one-time execution
}

interface CreateCronJobRequest {
  url: string;
  enabled: boolean;
  title: string;
  saveResponses?: boolean;
  schedule: CronJobSchedule;
  requestMethod?: number; // 0=GET, 1=POST, 2=PUT, 3=PATCH, 4=DELETE, 5=HEAD, 6=OPTIONS
  auth?: {
    enable: boolean;
    user?: string;
    password?: string;
  };
  notification?: {
    onFailure: boolean;
    onSuccess: boolean;
    onDisable: boolean;
  };
  extendedData?: {
    headers?: Record<string, string>; // Dictionary形式
    body?: string;
  };
}

interface CronJobResponse {
  jobId: number;
  enabled: boolean;
  title: string;
  url: string;
  schedule: CronJobSchedule;
  lastExecution?: {
    status: number;
    statusText: string;
    duration: number;
    date: string;
  };
}

export class CronJobOrgClient {
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  /**
   * APIキーを取得（DB優先、環境変数フォールバック）
   */
  private async getApiKey(): Promise<string | null> {
    if (this.apiKey) {
      return this.apiKey;
    }

    // DBから取得
    const dbKey = await getCronJobApiKey();
    if (dbKey) {
      this.apiKey = dbKey;
      return dbKey;
    }

    return null;
  }

  /**
   * APIキーが設定されているかチェック
   */
  async isConfigured(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return !!apiKey && apiKey.length > 0;
  }

  /**
   * cron-job.org にジョブを作成
   */
  async createJob(request: CreateCronJobRequest): Promise<CronJobResponse> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error("CRONJOB_API_KEY is not configured");
    }

    const response = await fetch(`${CRONJOB_API_BASE}/jobs`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        job: request,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`cron-job.org API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    // APIレスポンスは { jobId: number } 形式
    if (!data.jobId) {
      throw new Error(`Unexpected response structure from cron-job.org: ${JSON.stringify(data)}`);
    }

    // jobIdだけ返されるので、リクエスト情報と組み合わせて返す
    return {
      jobId: data.jobId,
      enabled: request.enabled,
      title: request.title,
      url: request.url,
      schedule: request.schedule,
    } as CronJobResponse;
  }

  /**
   * cron-job.org のジョブを更新
   */
  async updateJob(
    jobId: number,
    updates: Partial<CreateCronJobRequest>
  ): Promise<CronJobResponse> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error("CRONJOB_API_KEY is not configured");
    }

    const response = await fetch(`${CRONJOB_API_BASE}/jobs/${jobId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        job: updates,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `cron-job.org API error: ${response.status} ${error}`
      );
    }

    const data = await response.json();
    return data.jobDetails as CronJobResponse;
  }

  /**
   * cron-job.org のジョブを削除
   */
  async deleteJob(jobId: number): Promise<void> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error("CRONJOB_API_KEY is not configured");
    }

    const response = await fetch(`${CRONJOB_API_BASE}/jobs/${jobId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `cron-job.org API error: ${response.status} ${error}`
      );
    }
  }

  /**
   * cron-job.org のジョブ情報を取得
   */
  async getJob(jobId: number): Promise<CronJobResponse> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error("CRONJOB_API_KEY is not configured");
    }

    const response = await fetch(`${CRONJOB_API_BASE}/jobs/${jobId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `cron-job.org API error: ${response.status} ${error}`
      );
    }

    const data = await response.json();
    return data.jobDetails as CronJobResponse;
  }

  /**
   * Date オブジェクトから cron-job.org のスケジュール形式に変換
   * 1回だけ実行する場合は expiresAt を使用
   */
  static dateToSchedule(date: Date, timezone = "Asia/Tokyo", oneTime = false): CronJobSchedule {
    if (oneTime) {
      // 1回だけ実行: 具体的な日時を指定し、expiresAtで1分後に期限切れにする
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      // 実行時刻の1分後を期限にする（1回だけ実行されるように）
      const expiresDate = new Date(date.getTime() + 60000); // +1分
      const expYear = expiresDate.getFullYear();
      const expMonth = String(expiresDate.getMonth() + 1).padStart(2, '0');
      const expDay = String(expiresDate.getDate()).padStart(2, '0');
      const expHours = String(expiresDate.getHours()).padStart(2, '0');
      const expMinutes = String(expiresDate.getMinutes()).padStart(2, '0');
      const expSeconds = String(expiresDate.getSeconds()).padStart(2, '0');
      const expiresAt = parseInt(`${expYear}${expMonth}${expDay}${expHours}${expMinutes}${expSeconds}`);

      return {
        hours: [date.getHours()],
        minutes: [date.getMinutes()],
        mdays: [date.getDate()],
        months: [date.getMonth() + 1], // JavaScript は 0-indexed
        wdays: [-1], // すべての曜日（expiresAtで1回限りにする）
        timezone,
        expiresAt,
      };
    }

    // 繰り返し実行: 指定した日時で繰り返す
    return {
      hours: [date.getHours()],
      mdays: [date.getDate()],
      minutes: [date.getMinutes()],
      months: [date.getMonth() + 1], // JavaScript は 0-indexed
      wdays: [-1], // すべての曜日
      timezone,
    };
  }

  /**
   * 訓練通知用のcronジョブを作成
   */
  async createTrainingJob(params: {
    trainingId: string;
    scheduledTime: Date;
    title: string;
  }): Promise<number> {
    const { trainingId, scheduledTime, title } = params;

    // scheduledTimeはUTC時刻で渡されるため、JSTに変換
    // UTCからJSTは+9時間
    const jstTime = new Date(scheduledTime.getTime() + (9 * 60 * 60 * 1000));

    const callbackUrl = `${env.NEXT_PUBLIC_APP_URL}/api/cron/training-send?trainingId=${trainingId}`;

    const jobRequest: CreateCronJobRequest = {
      url: callbackUrl,
      enabled: true,
      title: `[訓練] ${title}`,
      saveResponses: true,
      schedule: CronJobOrgClient.dateToSchedule(jstTime, "Asia/Tokyo", true), // 1回だけ実行
      requestMethod: 0, // GET
      extendedData: {
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET || ""}`,
        },
      },
      notification: {
        onFailure: true,
        onSuccess: false,
        onDisable: false,
      },
    };

    const response = await this.createJob(jobRequest);
    return response.jobId;
  }
}
