import { Module } from '@nestjs/common';
import { SeoModule } from './modules/seo/seo.module';

@Module({
  imports: [SeoModule],
})
export class AppModule {}
