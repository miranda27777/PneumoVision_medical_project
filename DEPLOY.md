# PneumoVision 部署文档

## 一、服务器环境要求

| 组件 | 版本要求 |
|------|---------|
| 操作系统 | Ubuntu 22.04 |
| Java | JDK 17 |
| MySQL | 8.0+ |
| Redis | 6.0+ |
| RabbitMQ | 3.11+ |
| Nginx | 1.18+ |
| Node.js | 18+ / 20+ |
| Python | 3.10+ |

---

## 二、服务器环境配置

### 1. 更新系统并安装基础工具

```bash
apt update && apt upgrade -y
apt install -y curl wget git vim htop net-tools
```

### 2. 安装 Java 17

```bash
apt install -y openjdk-17-jdk
java -version
```

### 3. 安装 MySQL

```bash
apt install -y mysql-server
systemctl start mysql
systemctl enable mysql
mysql_secure_installation
```

### 4. 安装 Redis

```bash
apt install -y redis-server
systemctl start redis-server
systemctl enable redis-server
redis-cli ping  # 应返回 PONG
```

### 5. 安装 RabbitMQ

```bash
apt install -y rabbitmq-server
systemctl start rabbitmq-server
systemctl enable rabbitmq-server
```

### 6. 安装 Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 7. 安装 Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

### 8. 安装 Python 环境

```bash
apt install -y python3 python3-pip python3-venv
python3 --version
```

### 9. 安装中文字体（PDF导出需要）

```bash
apt install -y fonts-noto-cjk fonts-wqy-zenhei fonts-wqy-microhei
fc-cache -fv
```

### 10. 创建项目目录

```bash
mkdir -p /root/backend
mkdir -p /root/aices
mkdir -p /var/www/html/doctor
mkdir -p /var/www/html/admin
mkdir -p /var/www/html/researcher
mkdir -p /root/logs
```

---

## 三、数据库配置

### 1. 登录 MySQL

```bash
mysql -u root -p
```

### 2. 创建数据库和用户

```sql
CREATE DATABASE pneumovision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pneumo'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON pneumovision.* TO 'pneumo'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. 创建初始用户账号

后端启动后会自动创建表结构，但不会自动创建用户账号。需要手动在数据库中插入初始用户。

**第一步：使用 https://bcrypt-generator.com/ 网站生成密码哈希**

1. 打开 https://bcrypt-generator.com/
2. 输入密码（如 `123456`），点击 Generate
3. 复制生成的哈希值（以 `$2a$` 开头）

**第二步：插入用户数据**

```sql
INSERT INTO users (username, password, role, enabled, created_at)
VALUES 
('admin', '生成的哈希值', 'ADMIN', 1, NOW()),
('doctor', '生成的哈希值', 'DOCTOR', 1, NOW()),
('researcher', '生成的哈希值', 'RESEARCHER', 1, NOW());
```

---

## 四、后端部署

### 修改1：数据库连接配置

修改 `backend/src/main/resources/application.yml` 中的数据库连接信息：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/pneumovision?useSSL=false&serverTimezone=Asia/Shanghai
    username: pneumo
    password: your_password
```

### 修改2：敏感字段加密密钥

**生成加密密钥：**

```bash
python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
```

将生成的密钥配置到环境变量或配置文件中：

```bash
export FIELD_ENCRYPTION_KEY="生成的Base64密钥"
```

### 打包并启动后端

```bash
cd D:\backend_run\backend
.\mvnw.cmd clean package -DskipTests
scp target\*.jar root@your_server_ip:/root/backend/

ssh root@your_server_ip
cd /root/backend

nohup java -jar *.jar \
  --SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3306/pneumovision?useSSL=false&serverTimezone=Asia/Shanghai" \
  --SPRING_DATASOURCE_USERNAME="pneumo" \
  --SPRING_DATASOURCE_PASSWORD="your_password" \
  --FIELD_ENCRYPTION_KEY="生成的Base64密钥" \
  > /root/logs/backend.log 2>&1 &
```

---

## 五、AI 服务部署

### 1. 上传 AI 服务代码

```bash
scp -r D:\ai_run\aices\src root@your_server_ip:/root/aices/
scp D:\ai_run\aices\requirements.txt root@your_server_ip:/root/aices/
```

### 2. 安装 Python 依赖

```bash
ssh root@your_server_ip
cd /root/aices
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. 启动 AI 服务

```bash
cd /root/aices/src
source /root/aices/venv/bin/activate
nohup uvicorn app:app --host 0.0.0.0 --port 8081 > /root/logs/ai.log 2>&1 &
```

### 4. 验证 AI 服务

```bash
curl http://localhost:8081/docs
```

---

## 六、前端部署

### 1. 构建前端

```bash
# 医生端
cd D:\frontend_run\doctor
npm run build

# 管理员端
cd D:\frontend_run\admin
npm run build

# 科研人员端
cd D:\frontend_run\researcher
npm run build

# 登录页
cd D:\frontend_run\login
npm run build
```

### 2. 上传前端文件

```bash
# 登录页
scp -r D:\frontend_run\login\build\* root@your_server_ip:/var/www/html/

# 医生端
scp -r D:\frontend_run\doctor\dist\* root@your_server_ip:/var/www/html/doctor/

# 管理员端
scp -r D:\frontend_run\admin\dist\* root@your_server_ip:/var/www/html/admin/

# 科研人员端
scp -r D:\frontend_run\researcher\dist\* root@your_server_ip:/var/www/html/researcher/
```

---

## 七、Nginx 配置

### 配置文件路径：`/etc/nginx/sites-available/default`

```nginx
server {
    listen 80;
    server_name your_server_ip;

    client_max_body_size 100M;

    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    location /doctor {
        alias /var/www/html/doctor;
        try_files $uri $uri/ /doctor/index.html;
    }

    location /doctor/ {
        alias /var/www/html/doctor/;
        try_files $uri $uri/ /doctor/index.html;
    }

    location /admin {
        alias /var/www/html/admin;
        try_files $uri $uri/ /admin/index.html;
    }

    location /admin/ {
        alias /var/www/html/admin/;
        try_files $uri $uri/ /admin/index.html;
    }

    location /researcher {
        alias /var/www/html/researcher;
        try_files $uri $uri/ /researcher/index.html;
    }

    location /researcher/ {
        alias /var/www/html/researcher/;
        try_files $uri $uri/ /researcher/index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /ai/ {
        proxy_pass http://127.0.0.1:8081/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 启用配置并重启 Nginx

```bash
nginx -t
systemctl restart nginx
```

---

## 八、验证部署

| 服务 | 访问地址 |
|------|---------|
| 登录页 | `http://your_server_ip/` |
| 医生端 | `http://your_server_ip/doctor/` |
| 管理员端 | `http://your_server_ip/admin/` |
| 科研人员端 | `http://your_server_ip/researcher/` |
| 后端 API | `http://your_server_ip/api/` |
| AI 服务文档 | `http://your_server_ip/ai/docs` |

---

## 九、常用维护命令

### 查看服务状态

```bash
systemctl status mysql redis-server rabbitmq-server nginx
```

### 查看日志

```bash
tail -f /root/logs/backend.log      # 后端日志
tail -f /root/logs/ai.log           # AI 服务日志
tail -f /var/log/nginx/error.log    # Nginx 错误日志
```

### 重启后端

```bash
pkill java
cd /root/backend
nohup java -jar *.jar --server.port=8080 > /root/logs/backend.log 2>&1 &
```

### 重启 AI 服务

```bash
pkill uvicorn
cd /root/aices/src
source /root/aices/venv/bin/activate
nohup uvicorn app:app --host 0.0.0.0 --port 8081 > /root/logs/ai.log 2>&1 &
```

### 重启 Nginx

```bash
nginx -t && systemctl restart nginx
```

---

## 十、启动与访问

### 1. 确保所有服务已启动

```bash
systemctl status mysql redis-server rabbitmq-server nginx
ps aux | grep java
ps aux | grep uvicorn
```

### 2. 访问系统

- 登录页：`http://your_server_ip/`
- 医生端：`http://your_server_ip/doctor/`
- 管理员端：`http://your_server_ip/admin/`
- 科研人员端：`http://your_server_ip/researcher/`

### 3. 首次启动注意事项

- 确保 MySQL 中已创建 `pneumovision` 数据库
- 后端首次启动时会自动创建表结构
- 用户账号需手动创建
- 如遇到 RabbitMQ 连接问题，使用禁用模式启动：

```bash
nohup java -jar *.jar --server.port=8080 --spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration > /root/logs/backend.log 2>&1 &
```