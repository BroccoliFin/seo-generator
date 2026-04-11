// src/modules/seo/seo.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { GenerateSeoDto } from './dto/generate-seo.dto';
import { SeoOutput } from './interfaces/seo-output.interface';

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);
  private readonly flowiseUrl = process.env.FLOWISE_API_URL;
  private readonly flowiseKey = process.env.FLOWISE_API_KEY;
  private readonly timeout = parseInt(process.env.LLM_TIMEOUT_MS || '20000', 10);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Генерирует SEO-метаданные через Flowise API с поддержкой SSE-стриминга
   * и фоллбэком на обычный JSON-ответ
   */
  async generateStreaming(dto: GenerateSeoDto, res: Response): Promise<void> {
    // Настройка SSE-заголовков
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Отключаем буферизацию Nginx

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.logger.log(`[${requestId}] Starting SEO generation for: ${dto.product_name}`);

    try {
      // Проверка конфигурации
      if (!this.flowiseUrl || !this.flowiseKey) {
        throw new Error('Flowise configuration missing: FLOWISE_API_URL or FLOWISE_API_KEY');
      }

      // Запрос к Flowise Prediction API
      const response$ = this.httpService.post(
        this.flowiseUrl,
        {
          question: 'Generate SEO',
          overrides: {
            variables: {
              product_name: dto.product_name,
              category: dto.category,
              keywords: dto.keywords,
            },
          },
          streaming: true, // Просим стриминг, но принимаем и обычный ответ
        },
        {
          headers: {
            Authorization: `Bearer ${this.flowiseKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
          responseType: 'stream', // Пробуем получить стрим
        },
      );

      const response = await firstValueFrom(response$);
      const contentType = response.headers['content-type'] || '';

      // === ВАРИАНТ А: Пришёл SSE-стрим ===
      if (contentType.includes('text/event-stream')) {
        await this.handleStreamingResponse(response.data, res, requestId);
      } 
      // === ВАРИАНТ Б: Пришёл обычный JSON ===
      else {
        await this.handleJsonResponse(response.data, res, requestId);
      }

    } catch (error: any) {
      await this.handleError(error, res, requestId);
    }
  }

  /**
   * Обработка SSE-стрима от Flowise
   */
  private async handleStreamingResponse(
    stream: NodeJS.ReadableStream,
    res: Response,
    requestId: string,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      let accumulated = '';

      stream.on('data', (chunk: Buffer) => {
        const chunkStr = chunk.toString('utf8');
        accumulated += chunkStr;
        // Проксируем чанк клиенту в формате SSE
        res.write(` ${JSON.stringify({ chunk: chunkStr })}\n\n`);
      });

      stream.on('end', () => {
        try {
          // Пытаемся распарсить накопленный стрим
          const clean = accumulated.replace(/```json?/g, '').trim();
          const parsed: SeoOutput = JSON.parse(clean);
          
          res.write(` ${JSON.stringify({ done: true, result: parsed, requestId })}\n\n`);
          this.logger.log(`[${requestId}] Stream completed successfully`);
        } catch (parseError: any) {
          this.logger.warn(`[${requestId}] Stream parse error: ${parseError.message}`);
          res.write(` ${JSON.stringify({ 
            done: true, 
            warning: 'JSON parse failed', 
            raw: accumulated.slice(0, 300) 
          })}\n\n`);
        }
        res.end();
        resolve();
      });

      stream.on('error', (err: Error) => {
        this.logger.error(`[${requestId}] Stream error: ${err.message}`);
        res.write(` ${JSON.stringify({ error: true, message: 'Stream error', details: err.message })}\n\n`);
        res.end();
        resolve();
      });
    });
  }

  /**
   * Обработка обычного JSON-ответа от Flowise (Cloud-версия)
   * Ответ приходит в формате: { json: {...}, question: "...", chatId: "...", ... }
   */
  private async handleJsonResponse(
    stream: NodeJS.ReadableStream,
    res: Response,
    requestId: string,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));

      stream.on('end', async () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const flowiseResponse = JSON.parse(raw);

          // 🔑 КЛЮЧЕВОЙ МОМЕНТ: Извлекаем результат из поля "json"
          // Flowise Cloud возвращает: { json: {title, meta_description, ...}, ... }
          const result: SeoOutput = flowiseResponse.json || flowiseResponse;

          // Отправляем финальный результат клиенту
          res.write(` ${JSON.stringify({ done: true, result, requestId })}\n\n`);
          this.logger.log(`[${requestId}] JSON response processed successfully`);
        } catch (parseError: any) {
          this.logger.error(`[${requestId}] JSON parse error: ${parseError.message}`);
          res.write(` ${JSON.stringify({ 
            error: 'parse_failed', 
            message: parseError.message,
            requestId 
          })}\n\n`);
        }
        res.end();
        resolve();
      });

      stream.on('error', (err: Error) => {
        this.logger.error(`[${requestId}] JSON stream error: ${err.message}`);
        res.write(` ${JSON.stringify({ error: true, message: 'Stream error', details: err.message })}\n\n`);
        res.end();
        resolve();
      });
    });
  }

  /**
   * Универсальная обработка ошибок
   */
  private async handleError(
    error: any,
    res: Response,
    requestId: string,
  ): Promise<void> {
    this.logger.error(`[${requestId}] Request failed: ${error.message}`, error?.stack);

    let errorPayload: any;

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      // Таймаут запроса
      errorPayload = { 
        error: 'timeout', 
        message: `LLM did not respond within ${this.timeout}ms`,
        requestId 
      };
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      // Ошибка авторизации
      errorPayload = { 
        error: 'auth_failed', 
        message: 'Invalid Flowise API key or insufficient permissions',
        requestId 
      };
    } else if (error.response?.status === 404) {
      // Флоу не найден
      errorPayload = { 
        error: 'not_found', 
        message: 'Flowise chatflow not found. Check FLOWISE_API_URL',
        requestId 
      };
    } else if (error.response?.status === 429) {
      // Rate limit
      errorPayload = { 
        error: 'rate_limit', 
        message: 'Too many requests. Please try again later',
        requestId 
      };
    } else if (error.response?.data?.error) {
      // Ошибка от upstream-сервиса
      errorPayload = { 
        error: 'upstream_error', 
        message: error.response.data.error,
        details: error.response.data,
        requestId 
      };
    } else {
      // Неизвестная ошибка
      errorPayload = { 
        error: 'internal_error', 
        message: error.message || 'Unknown error occurred',
        requestId 
      };
    }

    res.write(` ${JSON.stringify(errorPayload)}\n\n`);
    res.end();
  }

  /**
   * Мок-режим для тестов без расхода токенов
   * Активируется при: MOCK_MODE=true или отсутствующей конфигурации Flowise
   */
  async generateMock(dto: GenerateSeoDto): Promise<SeoOutput> {
    this.logger.debug(`[MOCK] Generating SEO for: ${dto.product_name}`);
    
    // Имитация задержки сети (для реалистичного тестирования стриминга)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      title: `${dto.product_name} - Best ${dto.category}`,
      meta_description: `Buy ${dto.product_name} in ${dto.category}. Keywords: ${dto.keywords}`,
      h1: dto.product_name,
      description: `High-quality ${dto.product_name} for your needs. Features advanced technology and premium build quality.`,
      bullets: [
        `Premium ${dto.category.toLowerCase()} quality`,
        `Optimized for ${dto.keywords.split(',')[0]?.trim() || 'performance'}`,
        `Trusted by professionals worldwide`
      ]
    };
  }

  /**
   * Утилита: проверка, использовать ли мок-режим
   */
  shouldUseMock(): boolean {
    return (
      process.env.MOCK_MODE === 'true' ||
      !this.flowiseUrl ||
      !this.flowiseKey
    );
  }
}