import { Readable } from "stream";

export async function uploadImageToDrive(
  driveService,
  imageUrl,
  folderId,
  fileNameBase,
) {
  const response = await fetch(imageUrl);
  const mimeType = response.headers.get("Content-Type") || "image/jpeg"; // MIMEタイプを取得
  const extension = getExtensionFromMimeType(mimeType); // 拡張子を取得

  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  const fileMetadata = {
    name: `${fileNameBase}.${extension}`, // ファイル名を指定
    parents: [folderId], // アップロード先のGoogle DriveフォルダID
  };

  const media = {
    mimeType,
    body: Readable.from(imageBuffer), // バッファをストリームに変換
  };

  const file = await driveService.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id, webViewLink", // 作成されたファイルのIDとWebビューリンクを取得
  });

  return file.data.webViewLink; // Google Driveの画像URLを返す
}

// MIMEタイプから拡張子を取得する補助関数
function getExtensionFromMimeType(mimeType) {
  const mimeMap = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    // 他のMIMEタイプも必要に応じて追加
  };
  return mimeMap[mimeType] || "jpg"; // 未知のMIMEタイプの場合はデフォルトで 'jpg'
}
