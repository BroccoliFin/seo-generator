// src/modules/seo/seo.controller.ts
import { Controller, Post, Body, Res, HttpStatus, Logger, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { SeoService } from './seo.service';
import { GenerateSeoDto } from './dto/generate-seo.dto';

@Controller('seo')
export class SeoController {
  private readonly logger = new Logger(SeoController.name);

  constructor(private readonly seoService: SeoService) {}

  /**
   * POST /api/seo/generate-seo
   * Генерирует SEO-метаданные через Flowise API с поддержкой SSE-стриминга
   * 
   * Request Body:
   * {
   *   "product_name": "string",
   *   "category": "string", 
   *   "keywords": "string"
   * }
   * 
   * Response: SSE stream or JSON (if mock mode)
   */
  @Post('generate-seo')
  @HttpCode(200)
  async generateSeo(@Body() dto: GenerateSeoDto, @Res() res: Response): Promise<void> {
    // === Валидация входных данных ===
    if (!dto.product_name?.trim() || !dto.keywords?.trim()) {
      this.logger.warn(`Validation failed: missing fields for ${JSON.stringify(dto)}`);
      res.status(HttpStatus.BAD_REQUEST).json({ 
        error: 'validation_failed',
        message: 'Missing required fields: product_name and keywords are required',
        received: {
          product_name: !!dto.product_name?.trim(),
          category: !!dto.category?.trim(),
          keywords: !!dto.keywords?.trim()
        }
      });
      return;
    }

    // === Мок-режим: быстрый ответ без вызова LLM ===
    // Используется для демо, тестов и когда нет конфигурации Flowise
    if (this.seoService.shouldUseMock()) {
      this.logger.debug(`[MOCK] Generating SEO for: ${dto.product_name}`);
      
      try {
        const mock = await this.seoService.generateMock(dto);
        res.setHeader('Content-Type', 'application/json');
        res.json(mock);
      } catch (error: any) {
        this.logger.error(`[MOCK] Error: ${error.message}`);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'mock_failed',
          message: error.message
        });
      }
      return;
    }

    // === Продакшен-режим: стриминг через Flowise API ===
    this.logger.log(`[STREAM] Starting SEO generation for: ${dto.product_name}`);
    
    try {
      await this.seoService.generateStreaming(dto, res);
    } catch (error: any) {
      // Если стриминг ещё не начал отправку — можно вернуть ошибку как JSON
      if (!res.headersSent) {
        this.logger.error(`[STREAM] Fatal error: ${error.message}`);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'streaming_failed',
          message: error.message
        });
      }
      // Если headers уже отправлены — ошибка уже отправлена в стриме
    }
  }

  /**
   * GET /api/seo/health
   * Health check endpoint для мониторинга
   */
  @Post('health')
  @HttpCode(200)
  health(@Res() res: Response): void {
    const isMockMode = this.seoService.shouldUseMock();
    
    res.json({
      status: 'ok',
      mode: isMockMode ? 'mock' : 'production',
      timestamp: new Date().toISOString(),
      config: {
        flowiseUrl: !!process.env.FLOWISE_API_URL,
        flowiseKey: !!process.env.FLOWISE_API_KEY,
        timeout: process.env.LLM_TIMEOUT_MS || '20000'
      }
    });
  }
}