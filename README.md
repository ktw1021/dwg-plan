# DWG 파일 시각화 시스템

Web-based DWG File Visualization System

## 📋 프로젝트 개요

DWG 파일을 업로드하여 **인터랙티브 SVG 뷰어**로 시각화하는 웹 애플리케이션입니다.  
CAD 도면 파일을 브라우저에서 바로 확인하고, 줌/팬 기능으로 상세하게 탐색할 수 있습니다.

### 🎯 주요 기능
- **DWG 파일 업로드** - 다양한 AutoCAD 버전 지원
- **실시간 변환 상태** - Socket.IO 기반 진행 상황 표시  
- **인터랙티브 뷰어** - 마우스 휠 줌, 드래그 팬 기능
- **SVG 다운로드** - 변환된 도면 파일 저장
- **메모리 관리** - 90% of 1GB 제한으로 안정적 운영
- **성능 모니터링** - 처리 시간 제한 (30초) 및 메트릭 수집

### 🛠 기술 스택

```
Backend (Node.js):
├── Express.js - 웹 서버 프레임워크
├── Socket.IO - 실시간 상태 업데이트
├── Multer - 파일 업로드 처리
├── dxf-parser + @dxfjs/parser - DXF 파일 파싱
└── ODA File Converter - DWG→DXF 변환

Frontend (React):
├── React - 사용자 인터페이스
├── Socket.IO Client - 실시간 통신
├── Custom Hooks - 뷰어 상태 관리
└── CSS Transform - SVG 뷰어 줌/팬
```

### 🔄 변환 프로세스

```
1. DWG 파일 업로드
2. ODA File Converter로 DXF 변환
3. DXF 파일 파싱 및 분석
4. SVG 생성 및 최적화
5. 웹 뷰어 렌더링
```

---

## 🚀 설치 및 실행

### 📋 요구사항
- **Node.js** 14.x 이상
- **npm** 또는 yarn
- **[ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter)** (필수)
- **메모리** 최소 2GB 권장

### 📥 설치 과정

1. **저장소 클론**
   ```bash
   git clone https://github.com/ktw1021/dwg-plan.git
   cd dwg-plan
   ```

2. **의존성 설치**
   ```bash
   # 백엔드 의존성 설치
   cd backend
   npm install
   
   # 프론트엔드 의존성 설치  
   cd ../frontend
   npm install
   ```

3. **ODA File Converter 설치**
   - [ODA 공식 웹사이트](https://www.opendesign.com/guestfiles/oda_file_converter)에서 다운로드
   - 시스템에 맞는 버전 설치 (Windows/Mac/Linux)
   - 환경 변수 설정:
     ```bash
     # Windows 예시
     ODA_CONVERTER_PATH=C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe
     ```

### ▶️ 실행 방법

1. **백엔드 서버 실행**
   ```bash
   cd backend
   npm run dev    # 개발 모드 (nodemon)
   # 또는
   npm start      # 프로덕션 모드
   ```

2. **프론트엔드 서버 실행** (새 터미널)
   ```bash
   cd frontend
   npm start
   ```

3. **브라우저에서 접속**
   ```
   http://localhost:3000
   ```

---

## ⚙️ 환경 설정

### 환경 변수 (.env)
`backend/.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 서버 설정
PORT=5000
FRONTEND_URL=http://localhost:3000

# ODA File Converter 경로
ODA_CONVERTER_PATH=C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe

# 파일 업로드 제한
MAX_FILE_SIZE=10485760  # 10MB
MEMORY_LIMIT=1073741824 # 1GB
PROCESSING_TIMEOUT=30000 # 30초
```

---

## 📁 프로젝트 구조

```
dwg-plan/
├── backend/                 # Express 서버
│   ├── server.js           # 메인 서버 파일
│   ├── routes/             # API 라우트
│   ├── controllers/        # 비즈니스 로직
│   ├── utils/             
│   │   ├── core/          # 핵심 유틸리티
│   │   │   ├── errors.js    # 에러 클래스
│   │   │   ├── analyzer.js  # 도면 분석기
│   │   │   └── doorDetector.js # 문 검출기
│   │   ├── processors/    # 파일 처리
│   │   │   ├── main.js      # 메인 처리 로직
│   │   │   └── dwgConverter.js # DWG 변환기
│   │   └── renderers/     # 렌더링
│   │       └── svg.js       # SVG 렌더러
│   ├── uploads/           # 업로드된 파일
│   ├── results/           # 변환 결과
│   └── temp/             # 임시 파일
│
├── frontend/              # React 앱
│   ├── src/
│   │   ├── components/   # UI 컴포넌트
│   │   │   ├── FileUpload.js
│   │   │   ├── ProgressTracker.js
│   │   │   ├── ResultViewer.js
│   │   │   └── SVGViewer.js
│   │   ├── hooks/       # 커스텀 훅
│   │   │   ├── useViewer.js
│   │   │   └── useFileUpload.js
│   │   ├── context/     # 컨텍스트
│   │   ├── utils/       # 유틸리티
│   │   └── App.js       # 메인 앱
│   └── public/          # 정적 파일
└── README.md
```

---

## 🔧 API 문서

### DWG 파일 처리 API
- `POST /api/dwg/upload` - DWG 파일 업로드 및 변환 시작
- `GET /api/dwg/status/:jobId` - 변환 진행 상태 확인  
- `GET /api/dwg/result/:jobId` - 변환 결과 데이터 조회
- `GET /api/svg/:jobId` - SVG 파일 직접 다운로드

### WebSocket 이벤트
- `join` - 특정 작업 ID 방에 참여
- `progress` - 변환 진행 상황 업데이트
- `complete` - 변환 완료 알림
- `error` - 오류 발생 알림

---

## 🔍 주요 특징

### 인터랙티브 SVG 뷰어
- **마우스 휠 줌:** 포인터 위치 기준 확대/축소 (0.1x ~ 10x)
- **드래그 팬:** 클릭 드래그로 도면 이동
- **스크롤 격리:** SVG 영역에서만 휠 이벤트 처리
- **상태 유지:** 줌/팬 상태 완벽 보존

### 실시간 상태 업데이트
- Socket.IO 기반 양방향 통신
- 단계별 진행률 실시간 표시
- 오류 상황 즉시 알림

### 안정적인 파일 처리
- 10MB 파일 크기 제한
- 1GB 메모리 사용량 제한
- 30초 처리 시간 제한
- 상세한 에러 메시지와 컨텍스트 제공

### 에러 처리
- **FileError** - 파일 관련 오류
- **ConversionError** - 변환 과정 오류
- **ParsingError** - 파싱 관련 오류
- **AnalysisError** - 분석 과정 오류
- **RenderingError** - 렌더링 오류
- **MemoryError** - 메모리 초과 오류
- **PerformanceError** - 처리 시간 초과 오류

---

## 🐛 문제 해결

### ODA File Converter 관련
**문제:** `ODAFileConverter를 찾을 수 없음`  
**해결:**
- ODA File Converter가 올바르게 설치되었는지 확인
- 환경 변수 `ODA_CONVERTER_PATH` 경로 확인
- Windows 일반적인 설치 경로:
  - `C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe`
  - `C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe`

### DWG 파일 변환 오류
**문제:** `"Output version 'DWG' is invalid"`  
**해결:** ODA File Converter 커맨드 인자 순서 확인:
```bash
# 올바른 순서
ODAFileConverter "inputDir" "outputDir" "ACAD2018" "DXF" "0" "1"
```

### 메모리 사용량 초과
**문제:** `Memory limit exceeded`  
**해결:** 
- 더 작은 파일 사용
- 메모리 제한 증가 (환경 변수 수정)
- 임시 파일 정리 확인

### 처리 시간 초과
**문제:** `Processing timeout`  
**해결:**
- 더 작은 파일 사용
- 타임아웃 제한 증가
- 서버 리소스 확인

### 포트 충돌
**문제:** `포트 5000이 이미 사용 중`  
**해결:** `.env` 파일에서 다른 포트 설정:
```env
PORT=5001
```

---

**개발자:** [ktw1021](https://github.com/ktw1021)  
**저장소:** [dwg-plan](https://github.com/ktw1021/dwg-plan) 