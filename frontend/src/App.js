import React, { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import ProgressTracker from './components/ProgressTracker';
import ResultViewer from './components/ResultViewer';
import { SocketProvider } from './context/SocketContext';

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [jobId, setJobId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [result, setResult] = useState(null);

  const handleFileUploadSuccess = (uploadedJobId) => {
    setJobId(uploadedJobId);
    setCurrentStep(2);
  };

  const handleProcessingComplete = (resultData) => {
    setResult(resultData);
    setCurrentStep(3);
  };

  const resetApp = () => {
    setCurrentStep(1);
    setJobId(null);
    setUploadProgress(0);
    setProcessingProgress(0);
    setResult(null);
  };

  return (
    <SocketProvider>
    <div className="App">
      <header className="App-header">
          <h1>DWG 평면도 분석기</h1>
      </header>
        
        <main className="App-main">
          {currentStep === 1 && (
            <FileUpload 
              onUploadProgress={setUploadProgress} 
              onUploadSuccess={handleFileUploadSuccess}
              progress={uploadProgress}
            />
          )}
          
          {currentStep === 2 && jobId && (
            <ProgressTracker 
              jobId={jobId} 
              onProcessingProgress={setProcessingProgress}
              onProcessingComplete={handleProcessingComplete}
              progress={processingProgress}
            />
          )}
          
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
