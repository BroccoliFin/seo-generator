


![SEO Generator](https://github.com/user-attachments/assets/69132c7e-4224-4186-b973-5b5bd7b02279) 



<!-- ← Замени на реальное скриншот/GIF позже -->

<h1 align="center">SEO Description Generator API</h1>

<p align="center">
  <strong>NestJS + Flowise endpoint for generating SEO metadata with LLM streaming</strong>
</p>



[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)]()
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)]()
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)]()
[![Deployed on Render](https://img.shields.io/badge/Deployed-on%20Render-44cc11.svg)](https://seo-generator-api.onrender.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)]()

**[Русская версия → README.ru.md](./README.ru.md)**

## ✨ Features

- Full SEO metadata generation (title, meta description, keywords, Open Graph tags, etc.)
- **Real-time streaming** via Server-Sent Events (SSE)
- Structured JSON output with validation
- Flowise + any LLM integration through OpenRouter
- Clean modular NestJS architecture
- Full Docker support
- Global error handling

## 🛠️ Tech Stack

| Layer              | Technology                             |
|--------------------|----------------------------------------|
| Framework          | NestJS (TypeScript)                    |
| LLM Orchestration  | Flowise + OpenRouter (Qwen)            |
| Streaming          | Server-Sent Events (SSE)               |
| Validation         | class-validator + DTO                  |
| Containerization   | Docker + docker-compose                |

## 🚀 Quick Start

### Local Development

```bash
git clone https://github.com/BroccoliFin/seo-generator.git
cd seo-generator
npm install
cp .env.example .env
```
Configure your .env file (or keep MOCK_MODE=true for testing without API keys).
```
npm run start:dev
```
The API will be available at http://localhost:3000

Example Request
```
curl -X POST http://localhost:3000/api/seo/generate-seo \
  -H "Content-Type: application/json" \
  -d '{"product_name":"Test","category":"Test","keywords":"test"}'
```
### 🔄 Flowise Integration
This project uses a **Flowise chatflow** to orchestrate the LLM pipeline:
![Flowise sheme](https://github.com/user-attachments/assets/403c3ab5-5a6d-49cf-983f-df78770a456f)

### Chatflow Components:
- **Prompt Template**: Variables `{product_name}`, `{category}`, `{keywords}` with strict JSON schema instruction
- **OpenRouter Chat Model**: `qwen/qwen-2.5-72b-instruct` via OpenAI-compatible API
- **Structured Output Parser**: Enforces 5-field JSON schema (`title`, `meta_description`, `h1`, `description`, `bullets`)
- **LLM Chain**: Orchestrates prompt + model + parser with error handling

### Import the Chatflow:
1. Download [`seo-g Chatflow.json`](./flowise/seo-g-chatflow.json)
2. In Flowise UI: **Chatflows** → **Import** → Upload the JSON file
3. Configure OpenRouter credentials in the node settings
4. Save and get your **Chatflow ID** for the API endpoint

> 💡 The chatflow is exported and included in this repo for easy replication.
## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# App Settings
NODE_ENV=development
PORT=3000
CORS_ORIGIN=*

# Mock Mode (for demo without API costs)
# Set to "true" to use mock responses, "false" for real LLM calls
MOCK_MODE=true

# Flowise Configuration (required when MOCK_MODE=false)
FLOWISE_API_URL=https://your-flowise-instance/api/v1/prediction/your-chatflow-id
FLOWISE_API_KEY=your-flowise-api-key

# LLM Settings
LLM_TIMEOUT_MS=20000  # Timeout for LLM requests in milliseconds
```
## 🐳 Docker
Build and run
```
docker-compose up --build
```

## 🔧 Architecture

Client 
- NestJS (POST /api/seo/generate-seo) 
- Flowise Prediction API (SSE streaming) 
- LLM (OpenRouter/Qwen via OpenAI-compatible API)
- Structured Output Parser 
- Validated JSON Response
       
## 🗺️ Roadmap
- Support additional fields (H1, FAQ Schema, Article outline)
- Batch generation mode (multiple products at once)
- Swagger documentation
- Rate limiting and security middlewares
- Automated tests (Jest + Supertest)

## 🤝 Contributing
Pull requests are welcome!
Feel free to open an Issue or submit a PR if you find a bug or have an improvement. 
## 🪪 License
MIT License © BroccoliFin
