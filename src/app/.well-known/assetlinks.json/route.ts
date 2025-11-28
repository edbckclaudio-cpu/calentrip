import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const pkg = process.env.NEXT_PUBLIC_TWA_PACKAGE || "com.example.calentrip";
  const sha = (process.env.NEXT_PUBLIC_TWA_SHA256 || "").split(",").map((s) => s.trim()).filter(Boolean);
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
  return NextResponse.json(body);
}
