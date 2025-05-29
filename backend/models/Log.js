const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  level: {
    type: String,
    required: true,
    enum: ['error', 'warn', 'info', 'debug']
  },
  message: {
    type: String,
    required: true
  },
  jobId: {
    type: String,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// 인덱스 생성
logSchema.index({ timestamp: -1 });
logSchema.index({ level: 1, timestamp: -1 });

const Log = mongoose.model('Log', logSchema);

module.exports = Log; 