/**
 * パスワード強度チェック機能
 *
 * 要件:
 * - 8文字以上
 * - 大文字を1文字以上含む
 * - 小文字を1文字以上含む
 * - 数字を1文字以上含む
 * - 記号を1文字以上含む
 */

export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-5 (弱い-強い)
  feedback: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
}

const SYMBOLS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export function validatePasswordStrength(password: string): PasswordStrength {
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: SYMBOLS.test(password),
  };

  const feedback: string[] = [];

  if (!requirements.minLength) {
    feedback.push("8文字以上必要です");
  }
  if (!requirements.hasUppercase) {
    feedback.push("大文字を1文字以上含めてください");
  }
  if (!requirements.hasLowercase) {
    feedback.push("小文字を1文字以上含めてください");
  }
  if (!requirements.hasNumber) {
    feedback.push("数字を1文字以上含めてください");
  }
  if (!requirements.hasSymbol) {
    feedback.push("記号を1文字以上含めてください");
  }

  // スコア計算（各要件を満たすごとに1点）
  const score = Object.values(requirements).filter(Boolean).length;

  // すべての要件を満たす場合のみ有効
  const isValid = score === 5;

  return {
    isValid,
    score,
    feedback,
    requirements,
  };
}

/**
 * パスワード強度のレベルを取得
 */
export function getPasswordStrengthLevel(score: number): {
  label: string;
  color: string;
} {
  switch (score) {
    case 0:
    case 1:
      return { label: "弱い", color: "red" };
    case 2:
    case 3:
      return { label: "普通", color: "yellow" };
    case 4:
      return { label: "良い", color: "blue" };
    case 5:
      return { label: "強い", color: "green" };
    default:
      return { label: "弱い", color: "red" };
  }
}
