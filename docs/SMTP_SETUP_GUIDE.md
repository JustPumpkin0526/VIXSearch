# SMTP 설정 가이드

이메일 인증 기능을 사용하기 위한 SMTP 설정 방법입니다.

## 1. Gmail을 사용하는 경우 (권장)

### 1-1. Gmail 앱 비밀번호 생성

1. Google 계정 설정으로 이동: https://myaccount.google.com/
2. **보안** 탭 클릭
3. **2단계 인증** 활성화 (필수)
4. **앱 비밀번호** 클릭
5. 앱 선택: **메일**
6. 기기 선택: **기타(맞춤 이름)** → "VSS" 입력
7. **생성** 클릭
8. 생성된 16자리 비밀번호 복사 (예: `abcd efgh ijkl mnop`)

### 1-2. .env 파일 생성

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Gmail SMTP 설정
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
SMTP_FROM_EMAIL=your-email@gmail.com
```

**주의사항:**
- `SMTP_USER`: Gmail 주소 전체 입력
- `SMTP_PASSWORD`: 앱 비밀번호 (공백 포함 가능, 그대로 입력)
- `SMTP_FROM_EMAIL`: 보통 `SMTP_USER`와 동일

## 2. 다른 이메일 서비스 사용

### 2-1. Outlook/Hotmail

```env
SMTP_SERVER=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@outlook.com
```

### 2-2. Naver

```env
SMTP_SERVER=smtp.naver.com
SMTP_PORT=465
SMTP_USER=your-email@naver.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@naver.com
```

**참고:** Naver는 포트 465를 사용하며, `starttls()` 대신 `SMTP_SSL`을 사용해야 할 수 있습니다.

### 2-3. Daum/Kakao

```env
SMTP_SERVER=smtp.daum.net
SMTP_PORT=465
SMTP_USER=your-email@hanmail.net
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@hanmail.net
```

## 3. 개발 환경 (SMTP 설정 없이 테스트)

SMTP 설정이 없어도 개발 환경에서는 작동합니다:
- 인증 코드는 콘솔 로그에 출력됩니다
- 실제 이메일은 전송되지 않지만, 기능 테스트는 가능합니다

## 4. 코드 수정이 필요한 경우

특정 이메일 서비스가 작동하지 않으면 `vss-api.py`의 `send_verification_email` 함수를 수정해야 할 수 있습니다:

```python
# SSL을 사용하는 경우 (포트 465)
if SMTP_PORT == 465:
    server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
    server.login(SMTP_USER, SMTP_PASSWORD)
else:
    # TLS를 사용하는 경우 (포트 587)
    server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
    server.starttls()
    server.login(SMTP_USER, SMTP_PASSWORD)
```

## 5. 보안 주의사항

⚠️ **중요:**
- `.env` 파일은 절대 Git에 커밋하지 마세요
- `.gitignore`에 `.env` 추가 확인
- 프로덕션 환경에서는 환경 변수나 시크릿 관리 서비스 사용 권장

## 6. 테스트 방법

1. `.env` 파일 생성 및 설정
2. 서버 재시작
3. 회원가입 페이지에서 이메일 입력
4. "인증 코드 전송" 버튼 클릭
5. 이메일 수신 확인

## 7. 문제 해결

### 이메일이 전송되지 않는 경우

1. **앱 비밀번호 확인**: Gmail의 경우 일반 비밀번호가 아닌 앱 비밀번호 사용
2. **2단계 인증 확인**: Gmail은 2단계 인증이 활성화되어 있어야 함
3. **방화벽 확인**: 포트 587 또는 465가 차단되지 않았는지 확인
4. **로그 확인**: 서버 콘솔에서 에러 메시지 확인

### 인증 오류가 발생하는 경우

```
SMTPAuthenticationError: (535, '5.7.8 Username and Password not accepted')
```

- 사용자명과 비밀번호가 정확한지 확인
- Gmail의 경우 앱 비밀번호 사용 확인
- 계정이 잠겨있지 않은지 확인

