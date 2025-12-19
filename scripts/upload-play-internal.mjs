import fs from "node:fs"
import path from "node:path"
import { GoogleAuth } from "google-auth-library"
import { google } from "googleapis"

const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
const packageName = process.env.PLAY_PACKAGE_NAME || "digital.calentrip.android"
const aabPath = process.env.PLAY_AAB_PATH || path.resolve("android/app/build/outputs/bundle/release/app-release.aab")
const track = process.env.PLAY_TRACK || "internal"
const dry = process.env.DRY_RUN === "1"

function fail(msg, code = 1) {
  console.error(msg)
  process.exit(code)
}

if (!fs.existsSync(aabPath)) fail(`AAB not found at ${aabPath}`)

if (dry || !keyFile || !fs.existsSync(keyFile)) {
  console.log("DRY_RUN")
  console.log(`package=${packageName}`)
  console.log(`aab=${aabPath}`)
  console.log(`track=${track}`)
  process.exit(0)
}

async function main() {
  const auth = new GoogleAuth({ keyFile, scopes: ["https://www.googleapis.com/auth/androidpublisher"] })
  const client = await auth.getClient()
  const androidpublisher = google.androidpublisher({ version: "v3", auth: client })

  const insert = await androidpublisher.edits.insert({ packageName })
  const editId = insert.data.id

  const upload = await androidpublisher.edits.bundles.upload({
    packageName,
    editId,
    media: { mimeType: "application/octet-stream", body: fs.createReadStream(aabPath) },
  })

  const versionCode = upload.data.versionCode
  await androidpublisher.edits.tracks.update({
    packageName,
    editId,
    track,
    requestBody: { releases: [{ name: `v${versionCode}`, versionCodes: [String(versionCode)], status: "draft" }] },
  })

  await androidpublisher.edits.commit({ packageName, editId })
  console.log(`Uploaded versionCode=${versionCode} to track=${track}`)
}

main().catch(e => fail(e.message || String(e)))
