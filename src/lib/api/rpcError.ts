type RpcErrorLike = {
  message?: string | null;
  code?: string | null;
};

const CLIENT_ERROR_CODES = new Set([
  'P0001', // raise exception (business validation in our SQL functions)
  '22P02', // invalid_text_representation
  '22023', // invalid_parameter_value
  '23502', // not_null_violation
  '23503', // foreign_key_violation
  '23505', // unique_violation
  '23514', // check_violation
]);

export function getRpcHttpStatus(error: RpcErrorLike | null | undefined) {
  const code = error?.code?.toUpperCase() ?? null;

  if (code && CLIENT_ERROR_CODES.has(code)) {
    return 400;
  }

  return 500;
}
