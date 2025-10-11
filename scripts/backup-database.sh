#!/bin/bash
# PostgreSQL自動バックアップスクリプト

BACKUP_DIR="/app/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/anpikakunin_${TIMESTAMP}.sql"

# バックアップディレクトリ作成
mkdir -p ${BACKUP_DIR}

# データベースをダンプ
PGPASSWORD=postgres pg_dump -h postgres -U postgres -d anpikakunin > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
    echo "✅ バックアップ成功: ${BACKUP_FILE}"

    # 7日以上前のバックアップを削除
    find ${BACKUP_DIR} -name "anpikakunin_*.sql" -mtime +7 -delete
    echo "🗑️  古いバックアップを削除しました"
else
    echo "❌ バックアップ失敗"
    exit 1
fi
