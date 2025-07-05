// ユーザー設定の永続化ユーティリティ

interface UserSettings {
  soundEnabled: boolean;
  notificationThreshold: number;
  testMode: boolean;
}

const SETTINGS_KEY = "anpikakunin_user_settings";

// デフォルト設定
const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: false,
  notificationThreshold: 1,
  testMode: false,
};

// 設定を保存
export const saveSettings = (settings: Partial<UserSettings>): void => {
  try {
    const currentSettings = getSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
};

// 設定を読み込み
export const getSettings = (): UserSettings => {
  try {
    if (typeof window === "undefined") {
      return DEFAULT_SETTINGS;
    }

    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return DEFAULT_SETTINGS;
  }
};

// 特定の設定値を取得
export const getSetting = <K extends keyof UserSettings>(
  key: K
): UserSettings[K] => {
  return getSettings()[key];
};

// 特定の設定値を保存
export const setSetting = <K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K]
): void => {
  saveSettings({ [key]: value });
};
