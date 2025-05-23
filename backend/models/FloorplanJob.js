const fs = require('fs');
const path = require('path');

// File-system based job store
const jobsDir = path.join(__dirname, '..', 'jobs');
if (!fs.existsSync(jobsDir)) {
  fs.mkdirSync(jobsDir);
  console.log(`Created jobs directory: ${jobsDir}`);
}

class FloorplanJob {
  constructor(data) {
    this.jobId = data.jobId;
    this.filename = data.filename;
    this.status = data.status || 'pending';
    this.progress = data.progress || 0;
    this.message = data.message || '';
    this.doors = data.doors || [];
    this.imageUrl = data.imageUrl || null;
    this.error = data.error || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = new Date();
  }

  // Save job data to file
  async save() {
    console.log(`Saving job: ${this.jobId}`);
    const filePath = path.join(jobsDir, `${this.jobId}.json`);
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(this, null, 2));
      console.log(`Job saved: ${this.jobId}`);
      return this;
    } catch (error) {
      console.error(`Error saving job: ${error}`);
      throw error;
    }
  }

  // Find a job by ID
  static async findOne(query) {
    try {
      if (!query || !query.jobId) {
        console.log(`Invalid query: ${JSON.stringify(query)}`);
        return null;
      }
      
      const filePath = path.join(jobsDir, `${query.jobId}.json`);
      console.log(`Looking for job at: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`Job not found: ${query.jobId}`);
        return null;
      }
      
      const data = await fs.promises.readFile(filePath, 'utf8');
      console.log(`Job found: ${query.jobId}`);
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error finding job:`, error);
      return null;
    }
  }

  // Update a job by ID
  static async findByIdAndUpdate(id, updateData) {
    try {
      console.log(`Updating job: ${id}`);
      // In our simple implementation, id === jobId
      const filePath = path.join(jobsDir, `${id}.json`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`Job not found for update: ${id}`);
        return null;
      }
      
      const data = await fs.promises.readFile(filePath, 'utf8');
      const job = JSON.parse(data);
      
      // Update fields
      Object.assign(job, updateData, { updatedAt: new Date() });
      
      // Save updated job
      await fs.promises.writeFile(filePath, JSON.stringify(job, null, 2));
      console.log(`Job updated: ${id}, new status: ${job.status}`);
      
      return job;
    } catch (error) {
      console.error(`Error updating job: ${error}`);
      throw error;
    }
  }
}

module.exports = FloorplanJob; 