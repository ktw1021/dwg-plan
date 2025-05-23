# DWG 평면도 변환기

## 프로젝트 개요
DWG 파일을 업로드하여 SVG 평면도로 변환하고 분석하는 웹 애플리케이션입니다.
이 프로그램은 평면도에서 문(Door) 요소를 식별하고 위치를 추출합니다.

## 설치 방법

### 요구사항
- Node.js 14.x 이상
- npm 또는 yarn
- ODAFileConverter (DWG → DXF 변환에 필요)

### 설치 과정
1. 저장소 클론:
   ```
   git clone <repository-url>
   cd dwg-plan
   ```

2. 패키지 설치:
   ```
   cd backend
   npm install
   cd ../frontend
   npm install
   ```

### ODAFileConverter 설치 (필수)
이 애플리케이션은 DWG 파일을 처리하기 위해 ODA File Converter가 필요합니다:

1. [ODA 공식 웹사이트](https://www.opendesign.com/guestfiles/oda_file_converter)에서 다운로드
2. 시스템에 맞는 버전 설치 (Windows, Mac 또는 Linux)
3. 설치 후 환경 변수 설정 (선택사항):
   - Windows: `ODA_CONVERTER_PATH` 환경 변수에 ODAFileConverter.exe 경로 설정
   - 예: `C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe`

## 실행 방법

### 개발 환경
1. 백엔드 서버 실행:
   ```
   cd backend
   npm run dev
   ```

2. 프론트엔드 서버 실행:
   ```
   cd frontend
   npm run dev
   ```

3. 브라우저에서 `http://localhost:3000` 접속

### 환경 변수 설정
`.env` 파일을 백엔드 디렉토리에 생성하고 다음 변수 설정:

```
PORT=5000
FRONTEND_URL=http://localhost:3000
ODA_CONVERTER_PATH=C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe
```

## 문제 해결

### ODAFileConverter를 찾을 수 없음
- ODAFileConverter가 올바르게 설치되어 있는지 확인
- 환경 변수 `ODA_CONVERTER_PATH`에 실행 파일 경로를 올바르게 설정했는지 확인
- Windows에서 일반적인 설치 경로는 다음과 같습니다:
  - `C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe`
  - `C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe`

### DWG 파일 변환 오류
- DWG 파일이 손상되었거나 지원되지 않는 형식인지 확인
- ODAFileConverter가 해당 버전의 DWG 파일을 지원하는지 확인
- 로그 파일에서 오류 메시지 확인

## API 문서
- DWG 파일 업로드: `POST /api/dwg/upload`
- 변환 상태 확인: `GET /api/dwg/status/:jobId`
- 변환 결과 가져오기: `GET /api/dwg/result/:jobId`
- SVG 파일 직접 접근: `GET /api/svg/:jobId` 