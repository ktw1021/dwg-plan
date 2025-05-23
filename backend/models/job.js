const fs = require('fs');
const path = require('path');

// File-system based job store
const jobsDir = path.join(__dirname, '..', 'jobs');
if (!fs.existsSync(jobsDir)) {
  fs.mkdirSync(jobsDir, { recursive: true });
  console.log(`Created jobs directory: ${jobsDir}`);
}

/**
 * 간단한 작업 관리 모델
 */
const Job = {
  /**
   * 새 작업 생성
   */
  createJob: function(jobData) {
    console.log(`Creating job: ${jobData.id}`);
    
    const filePath = path.join(jobsDir, `${jobData.id}.json`);
    try {
      // 타임스탬프 추가
      const jobWithTimestamps = {
        ...jobData,
        createdAt: jobData.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      fs.writeFileSync(filePath, JSON.stringify(jobWithTimestamps, null, 2));
      console.log(`Job created: ${jobData.id}`);
      return jobWithTimestamps;
    } catch (error) {
      console.error(`Error creating job: ${error}`);
      throw error;
    }
  },
  
  /**
   * 작업 정보 가져오기
   */
  getJob: function(jobId) {
    const filePath = path.join(jobsDir, `${jobId}.json`);
    console.log(`Looking for job at: ${filePath}`);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`Job not found: ${jobId}`);
        return null;
      }
      
      const data = fs.readFileSync(filePath, 'utf8');
      console.log(`Job found: ${jobId}`);
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error getting job: ${error}`);
      return null;
    }
  },
  
  /**
   * 작업 정보 업데이트
   */
  updateJob: function(jobId, updateData) {
    console.log(`Updating job: ${jobId}`);
    const filePath = path.join(jobsDir, `${jobId}.json`);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`Job not found for update: ${jobId}`);
        return null;
      }
      
      const data = fs.readFileSync(filePath, 'utf8');
      const job = JSON.parse(data);
      
      // 필드 업데이트
      const updatedJob = {
        ...job,
        ...updateData,
        updatedAt: new Date()
      };
      
      // 변경된 작업 저장
      fs.writeFileSync(filePath, JSON.stringify(updatedJob, null, 2));
      console.log(`Job updated: ${jobId}`);
      
      return updatedJob;
    } catch (error) {
      console.error(`Error updating job: ${error}`);
      throw error;
    }
  },
  
  /**
   * 작업 삭제
   */
  deleteJob: function(jobId) {
    console.log(`Deleting job: ${jobId}`);
    const filePath = path.join(jobsDir, `${jobId}.json`);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`Job not found for deletion: ${jobId}`);
        return false;
      }
      
      fs.unlinkSync(filePath);
      console.log(`Job deleted: ${jobId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting job: ${error}`);
      return false;
    }
  }
};

module.exports = Job; 