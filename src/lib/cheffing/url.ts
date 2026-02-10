export function mergeQueryString(href: string, incomingQuery: string): string {
  const [beforeHash, hash] = href.split('#', 2);
  const [path, existingQuery] = beforeHash.split('?', 2);

  const existingParams = new URLSearchParams(existingQuery ?? '');
  const incomingParams = new URLSearchParams(incomingQuery ?? '');

  for (const [key, value] of incomingParams) {
    if (!existingParams.getAll(key).includes(value)) {
      existingParams.append(key, value);
    }
  }

  const finalQuery = existingParams.toString();
  let out = finalQuery ? `${path}?${finalQuery}` : path;

  if (hash) {
    out += `#${hash}`;
  }

  return out;
}
