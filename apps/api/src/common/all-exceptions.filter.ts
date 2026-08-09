import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * Stage 4 Phase 6 — error handling: known HttpExceptions pass through with
 * their { statusCode, code, message } shape; anything unexpected is logged
 * with its stack and returned as an opaque 500 (no internals leak to clients).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      reply.status(status).send(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`Unhandled error on ${request?.method} ${request?.url}: ${error.message}`, error.stack);
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}
