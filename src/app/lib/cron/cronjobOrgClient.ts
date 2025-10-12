// cron-job.org REST API Client
import { env } from "@/app/lib/env";

const CRONJOB_API_BASE = "https://api.cron-job.org";

interface CronJobSchedule {
  hours: number[]; // 0-23, -1 for all
  mdays: number[]; // 1-31, -1 for all
  minutes: number[]; // 0-59, -1 for all
  months: number[]; // 1-12, -1 for all
  wdays: number[]; // 0-6 (0=Sunday), -1 for all
  timezone: string; // e.g., "Asia/Tokyo"
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
    headers?: Array<{ key: string; value: string }>;
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
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.CRONJOB_API_KEY;
    if (!this.apiKey) {
      console.warn("⚠️ CRONJOB_API_KEY is not configured");
    }
  }

  /**
   * cron-job.org にジョブを作成
   */
  async createJob(request: CreateCronJobRequest): Promise<CronJobResponse> {
    const response = await fetch(`${CRONJOB_API_BASE}/jobs`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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
    return data.jobDetails as CronJobResponse;
  }

  /**
   * cron-job.org のジョブを更新
   */
  async updateJob(
    jobId: number,
    updates: Partial<CreateCronJobRequest>
  ): Promise<CronJobResponse> {
    const response = await fetch(`${CRONJOB_API_BASE}/jobs/${jobId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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
    const response = await fetch(`${CRONJOB_API_BASE}/jobs/${jobId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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
    const response = await fetch(`${CRONJOB_API_BASE}/jobs/${jobId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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
   */
  static dateToSchedule(date: Date, timezone = "Asia/Tokyo"): CronJobSchedule {
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

    const callbackUrl = `${env.NEXT_PUBLIC_APP_URL}/api/cron/training-send?trainingId=${trainingId}`;

    const jobRequest: CreateCronJobRequest = {
      url: callbackUrl,
      enabled: true,
      title: `[訓練] ${title}`,
      saveResponses: true,
      schedule: CronJobOrgClient.dateToSchedule(scheduledTime),
      requestMethod: 0, // GET
      extendedData: {
        headers: [
          {
            key: "Authorization",
            value: `Bearer ${env.CRON_SECRET}`,
          },
        ],
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
