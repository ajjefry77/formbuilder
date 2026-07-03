import { z } from 'zod';

export const createFormSchema = z.object({
  title: z.string().trim().min(1, 'عنوان فرم الزامی است').max(255),
  description: z.string().max(5000).optional().default(''),
  fields: z.array(z.record(z.any())).optional().default([]),
  settings: z.record(z.any()).optional().default({}),
  group_id: z.number().int().positive().nullable().optional(),
});

export const updateFormSchema = createFormSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const submitFormSchema = z.object({
  data: z.record(z.any()),
});

export function validate(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message || 'داده نامعتبر است',
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
