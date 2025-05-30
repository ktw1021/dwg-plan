# DWG 도면 분석 시스템 프로젝트 회고 (2024-05-30)

## 😤 아쉬운 점

### 1. DXF 파싱 라이브러리의 한계
- 대부분의 오픈소스 라이브러리에서 텍스트 위치, 엔티티 누락 등의 문제 발생
- DXF 라이브러리도 마찬가지로 하자가 있었지만, 커스텀 로직으로 보완할 수 있는 가능성이 있다고 판단
- 하지만 완전한 도면 렌더링이 어렵고, 안정성도 부족했음

### 2. 문 감지 정확도 부족
- 감지 기준이 한정적이라 다양한 형태의 문을 다 감지하지 못했음
- 블록 이름 기반 감지는 거의 안 되는 듯

### 3. MTEXT 위치/렌더링 실패
- 텍스트 좌표 및 크기 보정에 실패 → SVG에 글자가 엉뚱한 곳에 찍히거나 안 보임
- 도면 정보 시각화가 약해지고 분석 기능도 불완전해짐

### 4. 후처리 기능 미완성
- SVG 강조, 문 표시, 텍스트 마커 등 시각 효과가 부족함
- 기능은 있지만 완성도, 퀄리티 측면에서 미흡함

### 5. 프론트엔드 UI/UX 다듬지 못함
- 에러 핸들링, 진행률 표시, 사용자 피드백 등 세심한 부분 구현 시간 부족
- 급조된 느낌이 남았고, 실사용자 관점에선 불친절할 수 있음

### 6. 샘플 테스트 부족
- 단 두 개의 도면만 테스트해 구조 다양성을 검증하지 못함
- 테스트 커버리지가 부족하니 기능 신뢰도도 낮아질 수밖에 없었음

### 7. 시간 부족
- 리팩토링, 기능 추가, 테스트, 디버깅에 충분한 시간을 쓰지 못해 많은 기능이 절반만 구현됨

### 8. 상용 API 미사용
- Autodesk Forge API나 AutoCAD Web API 같은 상용 솔루션을 비용 문제와 의존성 부담 때문에 의도적으로 피했음
- 하지만 결과적으로 오픈소스 한계에 갇히게 됐고, API 기반의 완전한 DXF 지원 기능을 경험해보지 못한 것이 큰 아쉬움으로 남음

### 9. CAD 도메인 지식 부족
- DXF/DWG 파일 구조와 데이터에 대한 깊이 있는 이해 부족
- 로깅과 raw data 분석만으로는 한계가 있었음
- 실제 CAD 프로그램 사용 경험과 실무 지식이 없어 구현 방향 설정에 어려움
- 도면 요소들의 관계와 의미를 제대로 파악하지 못해 분석 로직이 피상적인 수준에 머무름

## 🧠 발전시키고 싶은 점

### 1. MTEXT 좌표 및 렌더링 정확도 향상
- 좌표 변환 행렬 직접 계산하여 MTEXT 위치 보정 로직 개발하고 싶음
- 폰트 크기, 정렬, 회전까지 반영한 렌더링 구현 목표

### 2. 문 감지 알고리즘 개선
- 도형 구조 분석 및 블록 패턴 인식 기반 감지 추가
- 문 형태를 유연하게 인식할 수 있는 고급 룰셋 설계

### 3. 파서 커스터마이징
- 기존 라이브러리 소스를 분석하고 수정하여 내가 원하는 방식으로 직접 파싱 처리하고 싶음
- 엔티티 분석 + SVG 변환 로직을 통합적으로 다룰 수 있게 리팩토링

### 4. 서버사이드 렌더링 전략 도입
- Python 등으로 DXF → SVG 변환을 서버에서 처리
- 클라이언트 부담을 줄이고 안정성 확보

### 5. 다양한 샘플 테스트 체계
- 10개 이상의 DXF 파일을 구조별로 수집
- 기능별 작동 여부를 체크할 수 있는 테스트 리스트 구축

### 6. UX 완성도 향상
- 유저가 신뢰하고 사용할 수 있는 UI 흐름 설계
- 에러 메시지, 로딩, 작업 진행률 등 디테일 완성도 강화

### 7. 결과물 품질 강화
- SVG 최적화, 도면 강조 표현 향상
- 분석 정보 시각화 추가로 정보성 높이기

### 8. CAD 도메인 전문성 강화
- AutoCAD 등 실무에서 사용되는 CAD 프로그램 학습
- DXF/DWG 파일 포맷 스펙 심층 분석
- 건축/설계 분야 실무자들의 실제 워크플로우 이해
- CAD 관련 커뮤니티 및 기술 문서 지속적 학습 