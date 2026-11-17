import { BadRequestException, type PipeTransform, type ValidationError } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export function validationException(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: flattenValidationErrors(errors),
    error: 'Bad Request',
  });
}

// Validates a body against an explicit DTO class. Passing the class in keeps
// validation working under Vitest, which does not emit design:paramtypes.
export function validatedBody<T extends object>(metatype: new () => T) {
  return new ValidatedBodyPipe(metatype);
}

class ValidatedBodyPipe<T extends object> implements PipeTransform<unknown, Promise<T>> {
  constructor(private readonly metatype: new () => T) {}

  async transform(value: unknown): Promise<T> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: ['Request body must be a JSON object'],
        error: 'Bad Request',
      });
    }

    const object = plainToInstance(this.metatype, value);
    const errors = await validate(object, { whitelist: true });
    if (errors.length > 0) {
      throw validationException(errors);
    }

    return object;
  }
}

function flattenValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children));
    }
  }
  return messages;
}
