const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Readable } = require("stream");
const sharp = require("sharp");

const s3 = new S3Client({ region: "ap-northeast-2" }); // 리전은 환경에 맞게 변경

exports.handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  // decodeURIComponent를 사용해 한글 깨짐 방지
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

  // 리사이즈된 이미지나 특정 경로의 이미지는 처리하지 않음 (무한업로드 방지)
  if (key.startsWith("resized-image/")) {
    return;
  }

  const fileName = key.split("/").pop();
  const baseFileName = fileName.split(".").slice(0, -1).join("."); // 확장자를 제외한 파일명만 추출
  // resized-image 폴더에 리사이징 완료한 이미지(resized-{파일명}.webp) 형식으로 저장
  const dstKey = `resized-image/resized-${baseFileName}.webp`; 

  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    var stream = response.Body;

    if (!stream instanceof Readable) {
      console.log("Unknown object stream type");
      return;
    }

    const content_buffer = Buffer.concat(await stream.toArray());

    const width = 90; // 리사이징 후 너비
    const height = 90; // 리사이징 후 높이

    const output = await sharp(content_buffer)
      .resize(width, height, { fit: "inside" }) // 비율을 유지하면서 꽉 차게 리사이즈
      .webp({ lossless: true }) // 무손실 webp로 변환
      .toBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: dstKey,
        Body: output,
        ContentType: "image/webp",
      })
    );

    console.log("Successfully resized and uploaded");
  } catch (error) {
    console.error("Error processing file", error);
  }
};
