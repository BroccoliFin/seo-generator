import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    if (response.headersSent) return;

    const status = exception.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception.message || 'Internal error';

    response.status(status).json({
      statusCode: status,
      error: status === 500 ? 'internal_error' : 'request_failed',
      message,
      timestamp: new Date().toISOString(),
    });
  }
}