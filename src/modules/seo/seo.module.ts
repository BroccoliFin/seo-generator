import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SeoService } from './seo.service';
import { SeoController } from './seo.controller';

@Module({
  imports: [HttpModule.register({ timeout: 20000, maxRedirects: 0 })],
  providers: [SeoService],
  controllers: [SeoController],
  exports: [SeoService],
})
export class SeoModule {}