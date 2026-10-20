// The deployed build, for UpdateReloader to compare with the build it is running.
export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID },
    { headers: { "Cache-Control": "no-store" } }
  );
}
