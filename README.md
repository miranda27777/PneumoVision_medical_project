# PneumoVision

PneumoVision 是一个肺部影像智能分析系统，提供病例管理、影像管理、模型推理、结果复核与审计日志等能力。  
项目由 Spring Boot 后端、FastAPI 推理服务和 Web 前端组成。

## 目录结构

```text
.
├── README.md                         # 项目介绍、本地部署
├── DEPLOY.md                         # 服务器部署
├── docs                              # 项目文档，包含需求文档、设计说明书、测试用例及测试报告
└── src
    ├── backend                       # Spring Boot API + 业务逻辑
    ├── aices                         # FastAPI 推理服务，包含模型、模型训练过程等
    ├── frontend                      # Web 前端
```

## 技术栈

- Backend: Java 17, Spring Boot, JPA, MySQL, Redis, RabbitMQ
- Inference: Python, FastAPI
- Frontend: React（Vite / CRA）
- AI Models:

   - RT-DETR（Real-Time Detection Transformer）：实时检测 Transformer 模型，采用端到端架构，无需 NMS 后处理，在密集目标和复杂场景下表现优异
   - YOLO（You Only Look Once）：实时目标检测模型，以速度快、部署灵活著称，是工业界和学术界广泛应用的成熟方案

## 环境依赖

- Java 17
- Python 3.10+
- Node.js 18+
- MySQL
- Redis
- RabbitMQ


# 🚀 服务器部署

- 见 [服务器部署文档](./DEPLOY.md)


# 🚀本地部署

## 配置项

后端配置文件：`src/backend/src/main/resources/application.yml`

常用环境变量（可覆盖默认值）：

```bash
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/pneumovision
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=your-database-password
SPRING_RABBITMQ_HOST=127.0.0.1
SPRING_RABBITMQ_PORT=5672
FIELD_ENCRYPTION_KEY=your_key_here
```
或将 application-local.yml.example 复制并重命名为 application-local.yml，然后根据本地环境填写数据库、字段加密密钥等配置项。
## 启动命令

### 1) 启动 AI 推理服务

```bash
cd src/aices
pip install -r requirements.txt
uvicorn app:app --host localhost --port 8081 --reload
```

### 2) 启动后端服务

```bash
cd src/backend
# Windows
.\mvnw.cmd spring-boot:run
# Linux/macOS/WSL
./mvnw spring-boot:run
```

### 3) 启动前端登录入口

```bash
cd src/frontend/login
npm install
npm start
```

### 4) 启动前端

```bash
cd src/frontend/doctor
npm install
npm run dev

cd src/frontend/admin
npm install
npm run dev

cd src/frontend/researcher
npm install
npm run dev
```

## 访问入口

- Web: `http://localhost:3000`
- Backend API: `http://localhost:8080`
- Swagger: `http://localhost:8080/swagger-ui.html`
- AICES Docs: `http://localhost:8081/docs`

