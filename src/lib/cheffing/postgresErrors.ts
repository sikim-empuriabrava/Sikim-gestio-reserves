export type PostgresError = {
  code?: string;
  message: string;
};

const constraintMessageMap: Record<string, string> = {
  cheffing_subrecipes_name_ci_unique: 'Ya existe una elaboración con ese nombre.',
  cheffing_dishes_name_ci_unique: 'Ya existe un plato con ese nombre.',
  cheffing_ingredients_name_ci_unique: 'Ya existe un ingrediente con ese nombre.',
  cheffing_subrecipe_items_unique_ingredient: 'Esta línea ya existe en la elaboración.',
  cheffing_subrecipe_items_unique_component: 'Esta línea ya existe en la elaboración.',
  cheffing_dish_items_unique_ingredient: 'Esta línea ya existe en el plato.',
  cheffing_dish_items_unique_subrecipe: 'Esta línea ya existe en el plato.',
  cheffing_subrecipe_items_waste_pct_check: 'La merma debe estar entre 0 y 1.',
  cheffing_dish_items_waste_pct_check: 'La merma debe estar entre 0 y 1.',
  cheffing_dish_items_waste_pct_override_check: 'La merma debe estar entre 0 y 1.',
  cheffing_ingredients_waste_pct_check: 'La merma debe estar entre 0 y 1.',
  cheffing_dishes_servings_check: 'Las raciones deben ser mayores que 0.',
};

const fallbackMessages: Record<string, string> = {
  '23505': 'Registro duplicado.',
  '23514': 'Los datos no cumplen las restricciones.',
  '23503': 'Referencia inválida o inexistente.',
};

const statusMap: Record<string, number> = {
  '23505': 409,
  '23514': 400,
  '23503': 409,
};

const findConstraintMessage = (message: string) => {
  return Object.entries(constraintMessageMap).find(([constraint]) => message.includes(constraint))?.[1] ?? null;
};

export const mapCheffingPostgresError = (error: PostgresError) => {
  if (!error.code) {
    return { status: 500, message: error.message };
  }

  const status = statusMap[error.code] ?? 500;
  const constraintMessage = findConstraintMessage(error.message);
  const fallbackMessage = fallbackMessages[error.code] ?? error.message;

  return {
    status,
    message: constraintMessage ?? fallbackMessage,
  };
};
