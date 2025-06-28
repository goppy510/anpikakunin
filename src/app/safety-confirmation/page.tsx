// このページは直接アクセス時のフォールバック用です
// WebSocket接続を維持するためメインページのルーティングを使用することを推奨
import { SafetyConfirmationDashboard } from "../components/safety-confirmation/pages/SafetyConfirmationDashboard";

export default function SafetyConfirmationPage() {
  return <SafetyConfirmationDashboard />;
}