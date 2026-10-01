/** Which commit this deployment was built from, so CI can wait for a deploy to finish. */
export function GET() {
  return Response.json({ commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null });
}
