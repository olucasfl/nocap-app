import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/** Valida body/query com zod; devolve 400 com a lista de problemas. */
export class ZodValidationPipe<S extends ZodTypeAny> implements PipeTransform<
  unknown,
  z.output<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Dados inválidos',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}
