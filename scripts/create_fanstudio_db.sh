#!/usr/bin/env bash
# 在本地 MySQL (localhost:3306) 创建 fanstudio 库
# 用法: export MYSQL_PWD=你的root密码; ./scripts/create_fanstudio_db.sh

set -e
MYSQL="${MYSQL:-/Users/fan/mysql/bin/mysql}"

if [ -z "$MYSQL_PWD" ] && [ -z "$MYSQL_ROOT_PASSWORD" ]; then
  echo "请先设置 MySQL root 密码，任选一种："
  echo "  export MYSQL_PWD=你的密码"
  echo "  export MYSQL_ROOT_PASSWORD=你的密码"
  echo "然后重新执行: ./scripts/create_fanstudio_db.sh"
  exit 1
fi

export MYSQL_PWD="${MYSQL_PWD:-$MYSQL_ROOT_PASSWORD}"
"$MYSQL" -u root -e "CREATE DATABASE IF NOT EXISTS fanstudio; SHOW DATABASES LIKE 'fanstudio';"
echo "数据库 fanstudio 已就绪。"
