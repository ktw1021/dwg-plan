const AWS = require('aws-sdk');
const logger = require('./logger');

// AWS S3 설정
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-northeast-2'
});

const bucket = process.env.AWS_S3_BUCKET || 'nvl-img';
const folder = process.env.AWS_S3_FOLDER || 'img';

/**
 * SVG 파일을 S3에 업로드
 * @param {string} jobId - 작업 ID
 * @param {Buffer|string} svgContent - SVG 파일 내용
 * @returns {Promise<string>} S3 URL
 */
const uploadSvgToS3 = async (jobId, svgContent) => {
  try {
    logger.info('S3 업로드 설정 확인', { 
      jobId,
      bucket,
      folder,
      region: process.env.AWS_REGION || 'ap-northeast-2'
    });

    const key = `${folder}/${jobId}.svg`;
    
    const params = {
      Bucket: bucket,
      Key: key,
      Body: svgContent,
      ContentType: 'image/svg+xml',
      ACL: 'public-read'
    };

    logger.info('S3 업로드 요청 시작', { 
      jobId,
      key,
      contentLength: svgContent.length
    });

    const result = await s3.upload(params).promise();
    logger.info('S3 업로드 완료', { 
      jobId, 
      url: result.Location,
      key: result.Key
    });
    
    return result.Location;
  } catch (error) {
    logger.error('S3 업로드 실패', { 
      jobId, 
      error: error.message,
      stack: error.stack,
      params: {
        bucket,
        folder,
        region: process.env.AWS_REGION
      }
    });
    throw error;
  }
};

/**
 * S3에서 SVG 파일 삭제
 * @param {string} jobId - 작업 ID
 */
const deleteSvgFromS3 = async (jobId) => {
  try {
    const key = `${folder}/${jobId}.svg`;
    
    const params = {
      Bucket: bucket,
      Key: key
    };

    await s3.deleteObject(params).promise();
    logger.info('SVG 파일 S3에서 삭제 완료', { jobId });
  } catch (error) {
    logger.error('SVG 파일 S3 삭제 실패', { jobId, error: error.message });
    throw error;
  }
};

/**
 * S3 URL 생성
 * @param {string} jobId - 작업 ID
 * @returns {string} S3 URL
 */
const getSvgUrl = (jobId) => {
  return `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${folder}/${jobId}.svg`;
};

module.exports = {
  s3,
  uploadSvgToS3,
  deleteSvgFromS3,
  getSvgUrl
}; 