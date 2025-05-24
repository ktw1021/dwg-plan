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

import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ProgressTracker from './components/ProgressTracker';
import ResultViewer from './components/ResultViewer';
import { SocketProvider } from './context/SocketContext';

function App() {
  // 애플리케이션 상태 관리
  const [currentStep, setCurrentStep] = useState(1);     // 현재 진행 단계
  const [jobId, setJobId] = useState(null);              // 작업 ID
  const [result, setResult] = useState(null);            // 처리 결과

  /**
   * 파일 업로드 성공 핸들러
   * 업로드 완료 시 진행률 추적 단계로 이동
   * @param {string} uploadedJobId - 업로드된 파일의 작업 ID
   */
  const handleFileUploadSuccess = (uploadedJobId) => {
    setJobId(uploadedJobId);
    setCurrentStep(2); // 진행률 추적 단계로 이동
  };

  /**
   * 처리 완료 핸들러
   * 파일 처리 완료 시 결과 뷰어 단계로 이동
   * @param {Object} resultData - 처리 결과 데이터
   */
  const handleProcessingComplete = (resultData) => {
    setResult(resultData);
    setCurrentStep(3); // 결과 뷰어 단계로 이동
  };

  /**
   * 애플리케이션 초기화
   * 모든 상태를 초기값으로 리셋하여 새로운 파일 업로드 준비
   */
  const resetApp = () => {
    setCurrentStep(1);
    setJobId(null);
    setResult(null);
  };

  return (
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
          {/* 1단계: 파일 업로드 */}
          {currentStep === 1 && (
            <FileUpload onUploadSuccess={handleFileUploadSuccess} />
          )}
          
          {/* 2단계: 처리 진행률 추적 */}
          {currentStep === 2 && jobId && (
            <ProgressTracker 
              jobId={jobId} 
              onProcessingComplete={handleProcessingComplete}
            />
          )}
          
          {/* 3단계: 결과 뷰어 */}
          {currentStep === 3 && result && (
            <ResultViewer 
              result={result}
              onReset={resetApp}
            />
          )}
        </main>
      </div>
    </SocketProvider>
  );
}

export default App;
