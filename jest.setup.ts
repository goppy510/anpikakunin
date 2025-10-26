import '@testing-library/jest-dom';

// テスト環境の環境変数設定
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@postgres:5432/anpikakunin_test';
process.env.NODE_ENV = 'test';
process.env.SLACK_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!!';
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:8080';
