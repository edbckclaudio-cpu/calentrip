import { NextResponse } from "next/server";
export const dynamic = "force-static";

function pickEnv<T extends string>(env: string, prodVar: T, stgVar: T): string {
  const v = env === "staging" ? process.env[stgVar] : process.env[prodVar];
  return (v || process.env[prodVar] || "").toString();
}

export async function GET() {
  const env = (process.env.NEXT_PUBLIC_TWA_ENV || "prod").toLowerCase();
  const pkg = pickEnv(env, "NEXT_PUBLIC_TWA_PACKAGE", "NEXT_PUBLIC_TWA_PACKAGE_STAGING") || "com.example.calentrip";
  const shaRaw = pickEnv(env, "NEXT_PUBLIC_TWA_SHA256", "NEXT_PUBLIC_TWA_SHA256_STAGING");
  const sha = (shaRaw || "").split(",").map((s) => s.trim()).filter(Boolean);
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: sha.length ? sha : ["CHANGE_ME"],
      },
    },
  ];
  return NextResponse.json(body, { status: 200, headers: { "Cache-Control": "public, max-age=3600" } });
}
