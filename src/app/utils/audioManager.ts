// 音声通知管理クラス

export class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private isEnabled = false;

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // 音声通知の有効/無効を設定
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // 音声通知が有効かどうか
  public getEnabled(): boolean {
    return this.isEnabled;
  }

  // AudioContextを初期化（ユーザーインタラクション後に呼び出す）
  private async initAudioContext(): Promise<void> {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        }
      } catch (error) {
        console.error("Failed to initialize AudioContext:", error);
      }
    }
  }

  // 警告音を生成・再生
  public async playAlert(intensity: number = 1): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      await this.initAudioContext();

      if (!this.audioContext) {
        console.warn("AudioContext not available");
        return;
      }

      // 震度に応じた音の設定
      const frequency = this.getFrequencyForIntensity(intensity);
      const duration = this.getDurationForIntensity(intensity);
      const beepCount = this.getBeepCountForIntensity(intensity);

      // 複数回のビープ音を再生
      for (let i = 0; i < beepCount; i++) {
        await this.playBeep(frequency, duration);
        if (i < beepCount - 1) {
          await this.sleep(200); // ビープ間の間隔
        }
      }
    } catch (error) {
      console.error("Failed to play alert sound:", error);
    }
  }

  // 単一のビープ音を生成・再生
  private async playBeep(frequency: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioContext) {
        resolve();
        return;
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(
        frequency,
        this.audioContext.currentTime
      );
      oscillator.type = "sine";

      // フェードイン・フェードアウト
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.3,
        this.audioContext.currentTime + 0.01
      );
      gainNode.gain.linearRampToValueAtTime(
        0,
        this.audioContext.currentTime + duration / 1000
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);

      oscillator.onended = () => resolve();
    });
  }

  // 震度に応じた周波数を決定
  private getFrequencyForIntensity(intensity: number): number {
    if (intensity >= 5) return 1000; // 高い音（緊急）
    if (intensity >= 3) return 800; // 中程度の音
    return 600; // 低い音
  }

  // 震度に応じた音の長さを決定
  private getDurationForIntensity(intensity: number): number {
    if (intensity >= 5) return 300; // 長い音（緊急）
    if (intensity >= 3) return 200; // 中程度の音
    return 150; // 短い音
  }

  // 震度に応じたビープ回数を決定
  private getBeepCountForIntensity(intensity: number): number {
    if (intensity >= 6) return 5; // 非常に多い
    if (intensity >= 5) return 3; // 多い
    if (intensity >= 3) return 2; // 中程度
    return 1; // 1回
  }

  // スリープ関数
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // テスト音を再生
  public async playTestSound(): Promise<void> {
    await this.playAlert(3); // 震度3相当のテスト音
  }
}
