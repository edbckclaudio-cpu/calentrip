export const dynamic = "force-static";
export async function GET() {
  const pkg = process.env.NEXT_PUBLIC_TWA_PACKAGE || "digital.calentrip.android";
  const shaEnv = process.env.NEXT_PUBLIC_TWA_SHA256 || "55:9F:B1:76:04:0A:11:00:FB:3B:36:3C:51:1C:B8:F2:B9:3D:53:2B:7F:A5:46:67:89:48:A7:1D:51:39:E3:55";
  const shaList = shaEnv.split(",").map((s) => s.trim()).filter(Boolean);
  const body = [
    {
      relation: [
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: shaList,
      },
    },
  ];
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

