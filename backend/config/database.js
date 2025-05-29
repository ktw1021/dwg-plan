const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dwg-plan';
    await mongoose.connect(mongoURI);
  } catch (error) {
    throw error; // 오류를 상위로 전파하여 서버 시작 실패 처리
  }
};

module.exports = connectDB; 