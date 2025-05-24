const Job = require('../models/job');
const path = require('path');
const fs = require('fs');

// 가장 단순하고 안정적인 프로세서를 사용
const dwgProcessor = require('../utils/dxfProcessor');

// 파일 타입별 처리 함수
const getFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.dwg':
      return 'dwg';
    case '.jpg':
    case '.jpeg':
      return 'jpeg';
    case '.png':
      return 'png';
    case '.pdf':
      return 'pdf';
    default:
      return 'unknown';
  }
};

// 이미지/PDF 파일을 위한 실제 파일 처리
const processImageFile = async (jobId, filename, filePath, progressCallback) => {
  const fileType = getFileType(filename);
  
  progressCallback(10, `${fileType.toUpperCase()} 파일 분석 중...`);
  
  // 잠시 대기 (실제 처리 시뮬레이션)
  await new Promise(resolve => setTimeout(resolve, 500));
  progressCallback(50, '파일 준비 중...');
  
  // results 폴더에 원본 파일 복사
  const resultsDir = path.join(__dirname, '..', 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  // 원본 파일 확장자 유지
  const originalExt = path.extname(filename);
  const resultFilePath = path.join(resultsDir, `${jobId}${originalExt}`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  progressCallback(80, '파일 복사 중...');
  
  // 파일 복사
  await fs.promises.copyFile(filePath, resultFilePath);
  
  progressCallback(100, '분석 완료');
  
  return {
    jobId,
    doors: [],
    imageUrl: `/results/${jobId}${originalExt}`,
    entityCount: 0,
    success: true,
    fileType,
    originalFile: resultFilePath
  };
};

// Upload a floorplan file
exports.uploadFloorplan = async (req, res) => {
  try {
    console.log('Upload floorplan request received');
    
    if (!req.file) {
      console.log('Error: No file uploaded');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { jobId } = req;
    const filename = req.file.originalname;
    const filePath = req.file.path;
    
    console.log(`File uploaded: ${filename} (jobId: ${jobId})`);
    console.log(`File path: ${filePath}`);
    
    // Create a new job using the Job model
    const newJob = Job.createJob({
      id: jobId,
      filename,
      originalPath: filePath,
      status: 'processing',
      progress: 0,
      message: '처리 시작 중...'
    });
    
    console.log(`Job created: ${jobId}`);
    
    // Get the Socket.IO instance
    const io = req.app.get('io');
    
    // 즉시 응답을 먼저 보내어 클라이언트가 기다리지 않게 함
    res.status(201).json({ success: true, jobId });
    
    // 안정적인 처리를 위해 직접 처리 함수 실행
    console.log(`Starting direct DWG processing for job: ${jobId}`);
    
    try {
      // 진행 상황 업데이트 콜백
      const progressCallback = (progress, status, data) => {
        console.log(`[${jobId}] Progress: ${progress}% - ${status}`);
        
        try {
          // 작업 상태 업데이트
          Job.updateJob(jobId, {
            progress,
            message: status
          });
          
          // 소켓으로 진행 상황 알림
          io.to(jobId).emit('progress', {
            jobId,
            percent: progress,
            message: status,
            data
          });
        } catch (updateError) {
          console.error(`Error updating progress: ${updateError.message}`);
        }
      };
      
      // 직접 처리 - 예외 발생해도 서버 중단되지 않도록 try-catch로 감싸기
      const fileType = getFileType(filename);
      let result;
      
      if (fileType === 'dwg') {
        // DWG 파일 처리
        result = await dwgProcessor.processDwgFile(jobId, filename, filePath, progressCallback);
        console.log(`DWG processing completed for job: ${jobId}`);
      } else if (['jpeg', 'png', 'pdf'].includes(fileType)) {
        // 이미지/PDF 파일 처리
        result = await processImageFile(jobId, filename, filePath, progressCallback);
        console.log(`${fileType.toUpperCase()} processing completed for job: ${jobId}`);
      } else {
        throw new Error(`지원되지 않는 파일 형식: ${fileType}`);
      }
      
      // 결과 저장
      const resultsDir = path.join(__dirname, '..', 'results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      
      // 파일 경로 및 URL 설정
      let imageUrl, svgPath;
      
      if (fileType === 'dwg') {
        // DWG 파일의 경우 SVG 파일 경로 사용
        svgPath = result.svgFile ? result.svgFile : path.join(resultsDir, `${jobId}.svg`);
        const svgFilename = path.basename(svgPath);
        imageUrl = `/results/${svgFilename}`;
      } else {
        // 이미지/PDF 파일의 경우 이미 imageUrl이 설정됨
        imageUrl = result.imageUrl;
      }
      
      // 작업 완료 상태로 업데이트
      Job.updateJob(jobId, {
        status: 'done',
        progress: 100,
        doors: result.doors || [],
        imageUrl: imageUrl,
        entityCount: result.entityCount || 0
      });
      
      // 완료 알림 전송
      io.to(jobId).emit('complete', {
        jobId,
        status: 'done',
        doors: result.doors || [],
        imageUrl: imageUrl,
        entityCount: result.entityCount || 0
      });
      
    } catch (processingError) {
      console.error(`Error in DWG processing: ${processingError.message}`);
      
      // 오류 상태 업데이트
      Job.updateJob(jobId, {
        status: 'error',
        message: processingError.message
      });
      
      // 오류 알림 전송
      io.to(jobId).emit('error', {
        jobId,
        message: `처리 오류: ${processingError.message}`
      });
    }
    
  } catch (error) {
    console.error('Error handling upload:', error);
    // 응답이 이미 보내진 경우를 대비해 try-catch로 감싸기
    try {
      res.status(500).json({ success: false, message: error.message });
    } catch (responseError) {
      console.error('Error sending error response:', responseError);
    }
  }
};

// Get the result of a floorplan analysis job
exports.getFloorplanResult = async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`Get result request for job: ${jobId}`);
    
    const job = Job.getJob(jobId);
    
    if (!job) {
      console.log(`Job not found: ${jobId}`);
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    
    console.log(`Job found: ${jobId}, status: ${job.status}`);
    
    // Return different responses based on job status
    switch (job.status) {
      case 'pending':
      case 'processing':
        return res.status(200).json({
          success: true,
          jobId: job.id,
          status: job.status,
          progress: job.progress || 0,
          message: job.message || '처리 중...'
        });
      
      case 'done':
        console.log(`Returning completed job: ${jobId} with ${job.doors?.length} doors`);
        return res.status(200).json({
          success: true,
          jobId: job.id,
          status: job.status,
          doors: job.doors,
          imageUrl: job.imageUrl,
          entityCount: job.entityCount || 0
        });
      
      case 'error':
        console.log(`Returning job with error: ${jobId}`);
        return res.status(400).json({
          success: false,
          jobId: job.id,
          status: job.status,
          error: job.message
        });
      
      default:
        console.log(`Unknown job status: ${job.status}`);
        return res.status(500).json({
          success: false,
          message: 'Unknown job status'
        });
    }
  } catch (error) {
    console.error('Error getting floorplan result:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}; 