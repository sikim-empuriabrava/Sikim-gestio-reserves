import { z } from 'zod';

const trimmedString = z.string().trim();
const allergenIndicatorArraySchema = z.array(trimmedString);

export const wastePctSchema = z.number().min(0).lt(1);

export const notesSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return value;
  },
  z.string().min(1).nullable().optional(),
);

export const subrecipeCreateSchema = z.object({
  name: trimmedString.min(1),
  output_unit_code: trimmedString.min(1),
  output_qty: z.number().positive(),
  waste_pct: wastePctSchema,
  notes: notesSchema,
});

export const subrecipeUpdateSchema = subrecipeCreateSchema
  .partial()
  .extend({
    allergens_manual_add: allergenIndicatorArraySchema.optional(),
    allergens_manual_exclude: allergenIndicatorArraySchema.optional(),
    indicators_manual_add: allergenIndicatorArraySchema.optional(),
    indicators_manual_exclude: allergenIndicatorArraySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields to update',
  });

export const subrecipeItemSchema = z
  .object({
    ingredient_id: z.string().uuid().nullable(),
    subrecipe_component_id: z.string().uuid().nullable(),
    unit_code: trimmedString.min(1),
    quantity: z.number().positive(),
    waste_pct: wastePctSchema,
    notes: notesSchema.optional(),
  })
  .refine(
    (data) => (data.ingredient_id ? 1 : 0) + (data.subrecipe_component_id ? 1 : 0) === 1,
    { message: 'Invalid component selection' },
  );

export const subrecipeItemCreateSchema = z
  .object({
    ingredient_id: z.string().uuid().nullable(),
    subrecipe_component_id: z.string().uuid().nullable(),
    unit_code: trimmedString.min(1),
    quantity: z.number().positive(),
    waste_pct: wastePctSchema.optional(),
    notes: notesSchema.optional(),
  })
  .refine(
    (data) => (data.ingredient_id ? 1 : 0) + (data.subrecipe_component_id ? 1 : 0) === 1,
    { message: 'Invalid component selection' },
  );

export const dishCreateSchema = z.object({
  name: trimmedString.min(1),
  selling_price: z.number().min(0).nullable().optional(),
  servings: z.number().positive(),
  notes: notesSchema,
});

export const dishUpdateSchema = dishCreateSchema
  .partial()
  .extend({
    allergens_manual_add: allergenIndicatorArraySchema.optional(),
    allergens_manual_exclude: allergenIndicatorArraySchema.optional(),
    indicators_manual_add: allergenIndicatorArraySchema.optional(),
    indicators_manual_exclude: allergenIndicatorArraySchema.optional(),
    image_path: trimmedString.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields to update',
  });

export const dishItemSchema = z
  .object({
    ingredient_id: z.string().uuid().nullable(),
    subrecipe_id: z.string().uuid().nullable(),
    unit_code: trimmedString.min(1),
    quantity: z.number().positive(),
    waste_pct: wastePctSchema,
    notes: notesSchema.optional(),
  })
  .refine((data) => (data.ingredient_id ? 1 : 0) + (data.subrecipe_id ? 1 : 0) === 1, {
    message: 'Invalid component selection',
  });

export const dishItemCreateSchema = z
  .object({
    ingredient_id: z.string().uuid().nullable(),
    subrecipe_id: z.string().uuid().nullable(),
    unit_code: trimmedString.min(1),
    quantity: z.number().positive(),
    waste_pct: wastePctSchema.optional(),
    notes: notesSchema.optional(),
  })
  .refine((data) => (data.ingredient_id ? 1 : 0) + (data.subrecipe_id ? 1 : 0) === 1, {
    message: 'Invalid component selection',
  });

export const subrecipeCreateWithItemsSchema = z.object({
  subrecipe: subrecipeCreateSchema,
  items: z.array(subrecipeItemCreateSchema).optional().default([]),
});

export const dishCreateWithItemsSchema = z.object({
  dish: dishCreateSchema,
  items: z.array(dishItemCreateSchema).optional().default([]),
});

export type SubrecipeCreateInput = z.infer<typeof subrecipeCreateSchema>;
export type SubrecipeUpdateInput = z.infer<typeof subrecipeUpdateSchema>;
export type SubrecipeItemInput = z.infer<typeof subrecipeItemSchema>;
export type SubrecipeItemCreateInput = z.infer<typeof subrecipeItemCreateSchema>;
export type SubrecipeCreateWithItemsInput = z.infer<typeof subrecipeCreateWithItemsSchema>;
export type DishCreateInput = z.infer<typeof dishCreateSchema>;
export type DishUpdateInput = z.infer<typeof dishUpdateSchema>;
export type DishItemInput = z.infer<typeof dishItemSchema>;
export type DishItemCreateInput = z.infer<typeof dishItemCreateSchema>;
export type DishCreateWithItemsInput = z.infer<typeof dishCreateWithItemsSchema>;
