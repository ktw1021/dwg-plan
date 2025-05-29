const mongoose = require('mongoose');

// 이미 존재하는 모델이 있다면 사용하고, 없으면 새로 생성
let Job;
try {
  Job = mongoose.model('Job');
} catch (error) {
  const jobSchema = new mongoose.Schema({
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    filename: {
      type: String,
      required: true
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'done', 'error'],
      default: 'pending'
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    message: {
      type: String,
      default: '준비 중...'
    },
    doors: [{
      type: mongoose.Schema.Types.Mixed
    }],
    imageUrl: {
      type: String
    },
    svgContent: {
      type: String
    },
    result: {
      type: mongoose.Schema.Types.Mixed
    },
    entityCount: {
      type: Number,
      default: 0
    },
    layerCount: {
      type: Number,
      default: 0
    },
    majorLayers: [{
      type: String
    }],
    logs: [{
      level: {
        type: String,
        enum: ['info', 'warn', 'error'],
        required: true
      },
      message: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed
      }
    }]
  }, {
    timestamps: true,
    strict: true
  });

  // 인덱스 생성
  jobSchema.index({ createdAt: -1 });
  jobSchema.index({ status: 1, createdAt: -1 });

  // 모델 생성
  Job = mongoose.model('Job', jobSchema);
}

module.exports = Job; 