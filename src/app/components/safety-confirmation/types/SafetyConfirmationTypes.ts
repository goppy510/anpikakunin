// 安否確認システムの型定義

export interface DepartmentStamp {
  id: string;
  name: string;
  slackEmoji: SlackEmoji; // Slackカスタムスタンプを使用
  color: string;
}

export interface NotificationTemplate {
  title: string;
  message: string;
  includeEventDetails: boolean;
  includeMapLink: boolean;
  customFields: Record<string, string>;
}

export interface SlackEmoji {
  name: string;
  url: string;
}

export interface SlackWorkspace {
  id: string;
  name: string;
  botToken?: string;
  isEnabled: boolean;
  // ワークスペース固有の設定
  departments: DepartmentStamp[];
  template: NotificationTemplate;
  conditions: NotificationConditions;
  availableEmojis?: SlackEmoji[]; // ワークスペースで利用可能な絵文字
}

export interface SlackChannel {
  id: string;
  workspaceId: string;
  channelId: string;
  channelName?: string; // 自動取得されるため任意
  channelType: "production" | "training"; // 本番用・訓練用チャンネル区分
  healthStatus?: "healthy" | "error" | "unknown"; // ヘルスチェック状況
}

export interface SlackNotificationSettings {
  workspaces: SlackWorkspace[];
  channels: SlackChannel[];
}

export interface NotificationConditions {
  minIntensity: number; // 最小震度
  targetPrefectures: string[]; // 対象都道府県コード
  enableMentions: boolean; // メンション有効化
  mentionTargets: string[]; // メンション対象（@channel, @here, 個別ユーザー）
  notificationType: "intensity" | "comprehensive"; // 震度速報 or 震源・震度に関する情報
}

export interface ScheduledTraining {
  id: string;
  workspaceId?: string; // 特定のワークスペース向け、未指定は全体
  scheduledTime: Date;
  message: string;
  enableMentions: boolean;
  mentionTargets: string[];
  isRecurring: boolean;
  recurringPattern?: "daily" | "weekly" | "monthly";
  isActive: boolean;
  lastExecuted?: Date;
}

export interface TrainingMode {
  isEnabled: boolean;
  testMessage: string;
  enableMentions: boolean;
  mentionTargets: string[];
  scheduledTrainings: ScheduledTraining[];
}

export interface SafetyConfirmationConfig {
  slack: SlackNotificationSettings;
  // 以下は削除：ワークスペース固有になったため
  // conditions: NotificationConditions;
  // departments: DepartmentStamp[];
  // template: NotificationTemplate;
  training: TrainingMode;
  isActive: boolean;
}

// 日本の都道府県データ
export const JAPANESE_PREFECTURES = [
  { code: "01", name: "北海道" },
  { code: "02", name: "青森県" },
  { code: "03", name: "岩手県" },
  { code: "04", name: "宮城県" },
  { code: "05", name: "秋田県" },
  { code: "06", name: "山形県" },
  { code: "07", name: "福島県" },
  { code: "08", name: "茨城県" },
  { code: "09", name: "栃木県" },
  { code: "10", name: "群馬県" },
  { code: "11", name: "埼玉県" },
  { code: "12", name: "千葉県" },
  { code: "13", name: "東京都" },
  { code: "14", name: "神奈川県" },
  { code: "15", name: "新潟県" },
  { code: "16", name: "富山県" },
  { code: "17", name: "石川県" },
  { code: "18", name: "福井県" },
  { code: "19", name: "山梨県" },
  { code: "20", name: "長野県" },
  { code: "21", name: "岐阜県" },
  { code: "22", name: "静岡県" },
  { code: "23", name: "愛知県" },
  { code: "24", name: "三重県" },
  { code: "25", name: "滋賀県" },
  { code: "26", name: "京都府" },
  { code: "27", name: "大阪府" },
  { code: "28", name: "兵庫県" },
  { code: "29", name: "奈良県" },
  { code: "30", name: "和歌山県" },
  { code: "31", name: "鳥取県" },
  { code: "32", name: "島根県" },
  { code: "33", name: "岡山県" },
  { code: "34", name: "広島県" },
  { code: "35", name: "山口県" },
  { code: "36", name: "徳島県" },
  { code: "37", name: "香川県" },
  { code: "38", name: "愛媛県" },
  { code: "39", name: "高知県" },
  { code: "40", name: "福岡県" },
  { code: "41", name: "佐賀県" },
  { code: "42", name: "長崎県" },
  { code: "43", name: "熊本県" },
  { code: "44", name: "大分県" },
  { code: "45", name: "宮崎県" },
  { code: "46", name: "鹿児島県" },
  { code: "47", name: "沖縄県" },
];

// デフォルト部署スタンプ（Slackカスタムスタンプ使用）
export const DEFAULT_DEPARTMENT_STAMPS: DepartmentStamp[] = [
  {
    id: "general",
    name: "総務部",
    slackEmoji: { name: "soumu", url: "" },
    color: "#3B82F6",
  },
  {
    id: "sales",
    name: "営業部",
    slackEmoji: { name: "eigyou", url: "" },
    color: "#10B981",
  },
  {
    id: "tech",
    name: "技術部",
    slackEmoji: { name: "gijutsu", url: "" },
    color: "#8B5CF6",
  },
  {
    id: "hr",
    name: "人事部",
    slackEmoji: { name: "jinji", url: "" },
    color: "#F59E0B",
  },
  {
    id: "finance",
    name: "経理部",
    slackEmoji: { name: "kaikei", url: "" },
    color: "#EF4444",
  },
  {
    id: "marketing",
    name: "マーケティング部",
    slackEmoji: { name: "marketing", url: "" },
    color: "#06B6D4",
  },
];

// デフォルト通知テンプレート
export const DEFAULT_NOTIFICATION_TEMPLATE: NotificationTemplate = {
  title: "🚨 地震発生通知",
  message:
    "地震が発生しました。安否確認のため、該当部署のスタンプを押してください。",
  includeEventDetails: true,
  includeMapLink: true,
  customFields: {},
};

// デフォルト通知条件
export const DEFAULT_NOTIFICATION_CONDITIONS: NotificationConditions = {
  minIntensity: 3,
  targetPrefectures: ["13", "14", "12"], // 東京、神奈川、千葉
  enableMentions: false,
  mentionTargets: [],
  notificationType: "comprehensive", // デフォルトは震源・震度に関する情報
};

// ワークスペース作成時のデフォルト設定
export const createDefaultWorkspace = (
  id: string,
  name: string = ""
): SlackWorkspace => ({
  id,
  name,
  botToken: "",
  isEnabled: true,
  departments: [...DEFAULT_DEPARTMENT_STAMPS],
  template: { ...DEFAULT_NOTIFICATION_TEMPLATE },
  conditions: { ...DEFAULT_NOTIFICATION_CONDITIONS },
});

// 訓練モード用メッセージ変換関数
export const formatTrainingMessage = (
  template: NotificationTemplate,
  isTrainingMode: boolean
): NotificationTemplate => {
  if (!isTrainingMode) {
    return template;
  }

  return {
    ...template,
    title: `【訓練です】 ${template.title} 【訓練です】`,
    message: `【訓練です】\n\n${template.message}\n\n【訓練です】`,
  };
};

// 送信対象チャンネルフィルタリング関数
export const getTargetChannels = (
  channels: SlackChannel[],
  isTrainingMode: boolean
): SlackChannel[] => {
  return channels.filter((channel) => {
    // 無効なチャンネルは除外
    if (!channel.isEnabled) {
      return false;
    }

    // 訓練モードの場合は訓練用チャンネルのみ
    if (isTrainingMode) {
      return channel.channelType === "training";
    }

    // 本番モードの場合は本番用チャンネルのみ
    return channel.channelType === "production";
  });
};
