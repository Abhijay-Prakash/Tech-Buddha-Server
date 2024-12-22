const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const uuid = require("uuid").v4;
const mime = require("mime-types");


exports.s3UploadV3 = async (buffer, fileName) => {
    const s3client = new S3Client();
    const uniqueFileName = `uploads/${uuid()}-${fileName}`;


    const contentType = mime.lookup(fileName) || "application/octet-stream";

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: uniqueFileName,
        Body: buffer,
        ContentType: contentType,
    };

    try {
        await s3client.send(new PutObjectCommand(params));


        const objectUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
        return { objectUrl, key: uniqueFileName };
    } catch (error) {
        console.error("Error uploading file to S3:", error);
        throw new Error("S3 Upload Failed");
    }
};
