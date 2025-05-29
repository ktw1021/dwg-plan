const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dwg-plan';
    await mongoose.connect(mongoURI);
    console.log('MongoDB 연결 성공');
  } catch (error) {
    console.error('MongoDB 연결 실패:', error.message);
    throw error; // 오류를 상위로 전파하여 서버 시작 실패 처리
  }
};

module.exports = connectDB; 