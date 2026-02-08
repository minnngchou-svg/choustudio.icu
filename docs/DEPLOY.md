# 生产部署指南

本文档面向负责将项目部署到服务器的开发者。如果你刚接手这个项目，建议从头阅读。

---

## 目录

- [项目技术概览](#项目技术概览)
- [服务器要求](#服务器要求)
- [部署步骤](#部署步骤)
  - [1. 安装基础环境](#1-安装基础环境)
  - [2. 获取项目代码](#2-获取项目代码)
  - [3. 配置环境变量](#3-配置环境变量)
  - [4. 初始化数据库](#4-初始化数据库)
  - [5. 构建与启动](#5-构建与启动)
  - [6. 配置 Nginx 反向代理](#6-配置-nginx-反向代理)
  - [7. 配置 SSL 证书](#7-配置-ssl-证书)
- [重要注意事项](#重要注意事项)
- [更新与维护](#更新与维护)
- [常见问题](#常见问题)

---

## 项目技术概览

| 技术 | 说明 |
|---|---|
| **Next.js 16** | 全栈框架 (App Router)，前台 SSR + 后台 SPA + API 路由一体 |
| **React 19** | UI 渲染 |
| **TypeScript** | 类型安全 |
| **Tailwind CSS 4** | 原子化样式 |
| **MySQL** | 关系型数据库 |
| **Prisma ORM** | 数据库操作，包含 migration 和 seed |
| **NextAuth.js v5** | 认证，JWT + Credentials Provider |
| **sharp** | 图片压缩（上传时自动转 WebP，限 1920px） |
| **wechatpay-node-v3** | 微信支付 Native 模式（可选） |
| **Resend** | 邮件发送（可选） |

**架构要点：**

- 前后端一体，无需单独部署 API 服务
- 图片存储在本地 `public/uploads/` 目录，由 Nginx 静态返回
- 微信支付和邮件为可选功能，不配置不影响其他功能
- 单管理员模式，一个 User 表对应一个后台管理员

---

## 服务器要求

| 项目 | 要求 |
|---|---|
| CPU | 2 核以上 |
| 内存 | 2 GB 以上（构建时需要较多内存） |
| 磁盘 | 40 GB 以上（图片上传会占用空间） |
| 操作系统 | Ubuntu 22.04 LTS（推荐）或 CentOS 8+ |
| Node.js | 20.x 或更高 |
| MySQL | 8.0 或更高 |
| Nginx | 最新稳定版 |
| PM2 | 最新版（进程管理） |

**端口：**

| 端口 | 用途 | 对外开放 |
|---|---|---|
| 80 | HTTP（Nginx） | 是 |
| 443 | HTTPS（Nginx） | 是 |
| 3000 | Next.js 应用（PM2） | 否，仅 localhost |
| 3306 | MySQL | 否，仅 localhost |

---

## 部署步骤

### 1. 安装基础环境

以 Ubuntu 22.04 为例。

**安装 Node.js 20.x：**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # 确认版本 >= 20
npm -v
```

**安装 MySQL 8.0：**

```bash
sudo apt-get install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# 执行安全初始化（设置 root 密码、移除匿名用户等）
sudo mysql_secure_installation
```

**安装 Nginx：**

```bash
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**安装 PM2：**

```bash
sudo npm install -g pm2
```

### 2. 获取项目代码

```bash
cd /var/www
git clone https://github.com/fan18660557495/fanstudio.git
cd fanstudio
npm install
```

> 如果 `npm install` 速度慢，先切换镜像源：
> ```bash
> npm config set registry https://registry.npmmirror.com
> ```

### 3. 配置环境变量

```bash
cp .env.example .env
```

用编辑器打开 `.env`，按以下表格填写：

#### 必填变量

| 变量 | 填写内容 | 说明 |
|---|---|---|
| `DATABASE_URL` | `mysql://用户名:密码@localhost:3306/fanstudio` | 把用户名和密码替换为实际值 |
| `AUTH_SECRET` | 执行 `openssl rand -base64 32` 生成 | **必须重新生成，不能用默认值** |
| `AUTH_URL` | `https://你的域名` | 生产环境必须是实际域名 |
| `NEXT_PUBLIC_SITE_URL` | `https://你的域名` | 与 AUTH_URL 一致 |

#### 选填变量

| 变量 | 填写内容 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_SITE_NAME` | 网站名称 | 可不填，后台可改 |
| `NEXT_PUBLIC_SITE_DOMAIN` | 域名（不含协议） | 用于 Figma 嵌入的 embed-host 参数 |
| `SMTP_HOST` | SMTP 服务器地址 | 163 填 `smtp.163.com`，不填则跳过邮件 |
| `SMTP_PORT` | SMTP 端口 | 通常 `465`（SSL） |
| `SMTP_USER` | 邮箱账号 | 如 `xxx@163.com` |
| `SMTP_PASS` | SMTP 授权码 | 邮箱设置中开启 SMTP 后获取 |
| `EMAIL_FROM` | 发件人邮箱 | 通常与 `SMTP_USER` 一致 |

#### 微信支付变量（完全可选）

不需要卖作品则全部留空。

| 变量 | 填写内容 | 获取位置 |
|---|---|---|
| `WECHAT_APP_ID` | 微信 AppID | 微信公众平台 → 基本配置 |
| `WECHAT_PAY_MCH_ID` | 商户号 | 微信商户平台 → 账户中心 |
| `WECHAT_PAY_API_KEY` | API v3 密钥 | 微信商户平台 → API 安全 |
| `WECHAT_PAY_SERIAL_NO` | 证书序列号 | 微信商户平台 → API 安全 |
| `WECHAT_PAY_PRIVATE_KEY` | 私钥 PEM 内容 | 与路径二选一 |
| `WECHAT_PAY_PRIVATE_KEY_PATH` | 私钥文件路径 | 默认 `cert/apiclient_key.pem` |
| `WECHAT_PAY_CERT` | 证书 PEM 内容 | 与路径二选一 |
| `WECHAT_PAY_CERT_PATH` | 证书文件路径 | 默认 `cert/apiclient_cert.pem` |
| `WECHAT_PAY_NOTIFY_URL` | 支付回调地址 | `https://你的域名/api/wechat/notify` |

> 微信支付证书文件放在项目根目录 `cert/` 下（该目录已被 `.gitignore` 排除）。

### 4. 初始化数据库

```bash
# 登录 MySQL，创建数据库
sudo mysql -u root -p
```

```sql
CREATE DATABASE fanstudio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 如果你不想用 root 连接，可以创建专用用户：
CREATE USER 'fanstudio'@'localhost' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON fanstudio.* TO 'fanstudio'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# 执行数据库迁移（创建所有表）
npx prisma migrate deploy

# 写入默认数据（管理员账号 + 默认分类 + 标签）
npm run db:seed
```

Seed 创建的默认管理员：

| 邮箱 | 密码 |
|---|---|
| `admin@example.com` | `admin123` |

> **部署完成后必须立即登录后台修改密码！**

### 5. 构建与启动

```bash
# 构建生产版本（包含 prisma generate）
npm run build

# 用 PM2 启动
pm2 start npm --name fanstudio -- start

# 保存进程列表（服务器重启后自动恢复）
pm2 save

# 设置开机自启
pm2 startup
# 按照输出的提示执行那条 sudo 命令
```

验证应用是否正常运行：

```bash
curl http://localhost:3000
# 应返回 HTML 内容
```

**常用 PM2 命令：**

```bash
pm2 status              # 查看进程状态
pm2 logs fanstudio      # 查看实时日志
pm2 restart fanstudio   # 重启
pm2 stop fanstudio      # 停止
```

### 6. 配置 Nginx 反向代理

创建站点配置：

```bash
sudo nano /etc/nginx/sites-available/fanstudio
```

写入以下内容（把 `your-domain.com` 替换为实际域名）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 上传文件大小限制（默认 1M 太小，图片上传会失败）
    client_max_body_size 20M;

    # 上传的图片由 Nginx 直接返回（性能更好）
    location /uploads/ {
        alias /var/www/fanstudio/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Next.js 静态资源（JS/CSS/字体等）长期缓存
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 其他请求转发给 Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置（微信支付回调可能耗时较长）
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
    gzip_comp_level 5;
}
```

启用站点并重载 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/fanstudio /etc/nginx/sites-enabled/
sudo nginx -t          # 测试配置是否正确
sudo systemctl reload nginx
```

### 7. 配置 SSL 证书

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 申请证书并自动配置 Nginx
sudo certbot --nginx -d your-domain.com

# 按提示操作：输入邮箱、同意条款、选择是否重定向 HTTP → HTTPS（建议选是）
```

验证自动续签：

```bash
sudo certbot renew --dry-run
```

Certbot 会自动添加 cron 任务，证书到期前自动续签。

---

## 重要注意事项

### 上传目录持久化

`public/uploads/` 存储所有用户上传的图片（封面图、作品展示图、头像等），**不在 git 中**。

- 更新代码时使用 `git pull`，不要删除整个项目重新 clone
- 推荐：将上传目录软链接到项目外的持久化路径

```bash
# 将上传目录移到项目外
sudo mkdir -p /data/fanstudio-uploads
sudo mv /var/www/fanstudio/public/uploads/* /data/fanstudio-uploads/ 2>/dev/null
sudo rmdir /var/www/fanstudio/public/uploads

# 创建软链接
ln -s /data/fanstudio-uploads /var/www/fanstudio/public/uploads
```

这样即使重新部署项目，上传的文件也不会丢失。同时 Nginx 配置中的 `alias` 也需要对应修改：

```nginx
location /uploads/ {
    alias /data/fanstudio-uploads/;
    # ...
}
```

### 微信支付证书文件

如果启用微信支付，需要在项目根目录创建 `cert/` 目录并放入证书：

```bash
mkdir -p /var/www/fanstudio/cert
# 将下载的证书文件上传到服务器后：
cp apiclient_key.pem /var/www/fanstudio/cert/
cp apiclient_cert.pem /var/www/fanstudio/cert/

# 设置严格权限
chmod 600 /var/www/fanstudio/cert/*.pem
```

### 安全清单

| 项目 | 操作 |
|---|---|
| AUTH_SECRET | 必须用 `openssl rand -base64 32` 重新生成 |
| 管理员密码 | 部署后立即登录后台修改 `admin123` |
| MySQL | 不要对公网开放 3306 端口 |
| .env 权限 | `chmod 600 .env` |
| cert 权限 | `chmod 600 cert/*.pem` |
| 防火墙 | 仅开放 80 和 443 端口 |

---

## 更新与维护

### 代码更新

```bash
cd /var/www/fanstudio

# 拉取最新代码
git pull origin main

# 安装可能新增的依赖
npm install

# 执行数据库迁移（如有新的表结构变更）
npx prisma migrate deploy

# 重新构建
npm run build

# 重启应用
pm2 restart fanstudio
```

### 数据库备份

```bash
# 手动备份
mysqldump -u root -p fanstudio > /data/backups/fanstudio_$(date +%Y%m%d_%H%M%S).sql
```

推荐设置定时自动备份：

```bash
sudo crontab -e
```

添加一行（每天凌晨 3 点备份）：

```
0 3 * * * mysqldump -u root -p'你的密码' fanstudio | gzip > /data/backups/fanstudio_$(date +\%Y\%m\%d).sql.gz
```

> 记得定期清理旧备份文件，防止磁盘占满。

### 日志查看

```bash
# 应用日志
pm2 logs fanstudio
pm2 logs fanstudio --lines 100    # 最近 100 行

# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log
```

---

## 常见问题

### npm install 报内存不足

构建 Next.js 项目需要较多内存。如果服务器只有 1G 内存，可以添加 swap：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

### npm run build 失败

1. 检查 `.env` 中的 `DATABASE_URL` 是否正确（构建时会连接数据库）
2. 确认已执行 `npx prisma migrate deploy`
3. 查看具体错误信息，通常是环境变量缺失或数据库连接问题

### 端口 3000 被占用

```bash
# 查找占用进程
lsof -i :3000

# 或者改用其他端口
PORT=3001 pm2 start npm --name fanstudio -- start
# 同时修改 Nginx 配置中的 proxy_pass 端口
```

### 上传图片失败

1. 确认 `public/uploads/` 目录存在且有写权限
2. 检查 Nginx 配置中 `client_max_body_size` 是否足够大
3. 如果用了软链接，确认链接目标目录有写权限

### 微信支付回调收不到

1. 确认 `WECHAT_PAY_NOTIFY_URL` 是 HTTPS 地址且公网可访问
2. 确认 Nginx 配置了 `X-Forwarded-Proto` header
3. 检查服务器防火墙是否允许外网访问 443 端口
4. 查看 `pm2 logs fanstudio` 中是否有支付相关错误

### 数据库连接超时

```bash
# 检查 MySQL 是否在运行
sudo systemctl status mysql

# 测试连接
mysql -u root -p -e "SELECT 1;"

# 检查 .env 中的连接串
cat .env | grep DATABASE_URL
```
