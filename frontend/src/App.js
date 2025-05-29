/**
 * DWG 파일 분석 시스템 메인 애플리케이션
 * 
 * 주요 기능:
 * - DWG 파일 업로드
 * - 실시간 처리 진행률 추적
 * - SVG 결과 뷰어
 * 
 * 상태 관리:
 * - currentStep: 현재 진행 단계 (1: 업로드, 2: 처리중, 3: 결과)
 * - jobId: 작업 식별자
 * - result: 처리 결과 데이터
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import UploadPage from './pages/UploadPage';
import ProgressPage from './pages/ProgressPage';
import ResultPage from './pages/ResultPage';

function App() {
  return (
    <Router>
      <SocketProvider>
        <div style={{ 
          fontFamily: "'Segoe UI', 'Roboto', sans-serif",
          minHeight: '100vh',
          background: '#fff',
          color: '#333'
        }}>
          {/* 헤더 영역 (현재 숨김 처리) */}
          <header style={{
            background: 'white',
            padding: '15px 0',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <h1 style={{ 
              margin: 0, 
              fontSize: '20px', 
              fontWeight: 500,
              display: 'none' // 헤더 숨김
            }}>
              DWG 평면도 분석기
            </h1>
          </header>
          
          {/* 메인 컨텐츠 영역 */}
          <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/upload" replace />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/progress/:jobId" element={<ProgressPage />} />
              <Route path="/result/:jobId" element={<ResultPage />} />
            </Routes>
          </main>
        </div>
      </SocketProvider>
    </Router>
  );
}

export default App;
