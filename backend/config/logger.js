const winston = require('winston');
require('winston-mongodb');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // MongoDB 저장
    new winston.transports.MongoDB({
      db: process.env.MONGODB_URI || 'mongodb://localhost:27017/dwg-plan',
      collection: 'logs',
      options: {
        useUnifiedTopology: true
      },
      metaKey: 'metadata'
    })
  ]
});

// 개발 환경에서는 더 자세한 로깅
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
}

module.exports = logger; 