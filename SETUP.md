# 배포 가이드

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) → 무료 계정 → 새 프로젝트 생성
2. **SQL Editor**에서 `supabase/schema.sql` 전체 실행
3. **Project Settings > API**에서 다음 값 복사:
   - `Project URL` (예: `https://abcdef.supabase.co`)
   - `Project Ref` (예: `abcdef`)

## 2. Edge Function 배포

```bash
# Supabase CLI 설치 (처음만)
npm install -g supabase

# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_REF

# 환경변수(Secrets) 설정
supabase secrets set HMAC_SECRET="여기에_랜덤_긴_문자열_입력"
supabase secrets set ALLOWED_ORIGIN="https://YOUR_GITHUB_PAGES_URL"

# Edge Function 배포
supabase functions deploy api
```

> HMAC_SECRET 예시: `openssl rand -hex 32` 명령으로 생성

## 3. 프론트엔드 설정

`js/config.js` 파일에서 아래 값 수정:

```js
export const API_BASE = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/api';
```

## 4. GitHub Pages 배포

1. GitHub 저장소 생성 (Public)
2. 이 폴더 전체를 push
3. **Settings > Pages > Branch: main / root** 설정
4. 배포 URL: `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO/`

## 파일 구조

```
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js      ← API_BASE 값 수정 필요
│   ├── utils.js
│   ├── pieces.js
│   ├── board.js
│   ├── ranking.js
│   └── game.js
└── supabase/
    ├── schema.sql     ← Supabase SQL Editor에서 실행
    └── functions/
        └── api/
            └── index.ts  ← Edge Function
```

## 보안 구조 요약

| 위협 | 대응 |
|------|------|
| API 키 노출 | Edge Function 환경변수에만 존재, 클라이언트 미노출 |
| 점수 조작 | HMAC 서명 토큰 + 서버 점수 범위 검증 |
| 중복 제출 | used_tokens 테이블로 1회용 토큰 강제 |
| 도배 제출 | IP 기반 Rate Limiting (8초 쿨다운) |
| 직접 DB 접근 | RLS로 anon 접근 완전 차단 |
| 게임 시간 우회 | 토큰 발급 시각 기반 경과 시간 검증 |
