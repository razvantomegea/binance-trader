export function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorizationHeader = request.headers.get("authorization");
  const bearerToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : undefined;
  const headerToken = request.headers.get("x-cron-secret")?.trim();
  const token = bearerToken ?? headerToken;

  return Boolean(secret && token === secret);
}
