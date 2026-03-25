#!/usr/bin/env python3
"""
SMTP 설정 도우미 스크립트
프로젝트 루트에 .env 파일을 생성합니다.
실행: 프로젝트 루트에서 `python scripts/setup_smtp.py`
"""

import os
from pathlib import Path

def _project_root() -> Path:
    """이 파일은 scripts/ 아래에 있으므로 상위가 저장소 루트입니다."""
    return Path(__file__).resolve().parent.parent


def create_env_file():
    """SMTP 설정을 위한 .env 파일 생성"""
    env_path = _project_root() / ".env"

    if env_path.exists():
        print("⚠️  .env 파일이 이미 존재합니다.")
        response = input("덮어쓰시겠습니까? (y/N): ")
        if response.lower() != 'y':
            print("취소되었습니다.")
            return

    print("\n=== VSS SMTP 설정 ===")
    print("\n이메일 서비스를 선택하세요:")
    print("1. Gmail (개인 계정)")
    print("2. Google Workspace (커스텀 도메인, 예: @intellivix.ai)")
    print("3. Microsoft 365 / Outlook (커스텀 도메인 포함)")
    print("4. Naver")
    print("5. Daum/Kakao")
    print("6. 기타 (직접 입력)")

    choice = input("\n선택 (1-6): ").strip()

    smtp_configs = {
        "1": {
            "server": "smtp.gmail.com",
            "port": "587",
            "note": "Gmail 사용 시 앱 비밀번호가 필요합니다."
        },
        "2": {
            "server": "smtp.gmail.com",
            "port": "587",
            "note": "Google Workspace 사용 시 앱 비밀번호가 필요합니다.\n   (예: @intellivix.ai 도메인)"
        },
        "3": {
            "server": "smtp.office365.com",
            "port": "587",
            "note": "Microsoft 365 사용 시 계정 비밀번호 또는 앱 비밀번호를 사용합니다.\n   (예: @intellivix.ai 도메인)"
        },
        "4": {
            "server": "smtp.naver.com",
            "port": "465",
            "note": "Naver 계정 비밀번호를 사용합니다."
        },
        "5": {
            "server": "smtp.daum.net",
            "port": "465",
            "note": "Daum 계정 비밀번호를 사용합니다."
        }
    }

    if choice in smtp_configs:
        config = smtp_configs[choice]
        print(f"\n{config['note']}")
        smtp_server = config["server"]
        smtp_port = config["port"]
    elif choice == "6":
        smtp_server = input("SMTP 서버 주소: ").strip()
        smtp_port = input("SMTP 포트 (587 또는 465): ").strip()
    else:
        print("잘못된 선택입니다.")
        return

    print("\n이메일 계정 정보를 입력하세요:")
    smtp_user = input("이메일 주소 (예: noreply@intellivix.ai): ").strip()

    if choice == "1":
        print("\n⚠️  Gmail 사용 시:")
        print("1. Google 계정 → 보안 → 2단계 인증 활성화")
        print("2. 앱 비밀번호 생성 (앱: 메일, 기기: 기타)")
        print("3. 생성된 16자리 비밀번호를 입력하세요")
    elif choice == "2":
        print("\n⚠️  Google Workspace 사용 시:")
        print("1. Google Admin Console에서 해당 계정으로 로그인")
        print("2. Google 계정 → 보안 → 2단계 인증 활성화")
        print("3. 앱 비밀번호 생성 (앱: 메일, 기기: 기타)")
        print("4. 생성된 16자리 비밀번호를 입력하세요")
    elif choice == "3":
        print("\n⚠️  Microsoft 365 사용 시:")
        print("1. Microsoft 365 Admin Center에서 계정 확인")
        print("2. 2단계 인증 활성화 시 앱 비밀번호 사용")
        print("3. 일반 비밀번호 또는 앱 비밀번호를 입력하세요")

    smtp_password = input("비밀번호 (또는 앱 비밀번호): ").strip()
    smtp_from = input(f"발신자 이메일 (기본값: {smtp_user}): ").strip() or smtp_user

    env_content = f"""# SMTP 이메일 설정
# 자동 생성된 파일입니다.

SMTP_SERVER={smtp_server}
SMTP_PORT={smtp_port}
SMTP_USER={smtp_user}
SMTP_PASSWORD={smtp_password}
SMTP_FROM_EMAIL={smtp_from}
"""

    try:
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write(env_content)
        print(f"\n✅ .env 파일이 생성되었습니다: {env_path.absolute()}")
        print("\n⚠️  보안 주의사항:")
        print("- .env 파일은 절대 Git에 커밋하지 마세요")
        print("- .gitignore에 .env가 포함되어 있는지 확인하세요")
        print("\n서버를 재시작하면 SMTP 설정이 적용됩니다.")
    except Exception as e:
        print(f"\n❌ .env 파일 생성 실패: {e}")


def test_smtp_connection():
    """SMTP 연결 테스트"""
    from dotenv import load_dotenv
    load_dotenv(_project_root() / ".env")

    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not all([smtp_server, smtp_user, smtp_password]):
        print("❌ .env 파일에 SMTP 설정이 없습니다.")
        print("먼저 프로젝트 루트에서 `python scripts/setup_smtp.py`를 실행하여 설정하세요.")
        return

    print("\nSMTP 연결 테스트 중...")
    print(f"서버: {smtp_server}:{smtp_port}")
    print(f"사용자: {smtp_user}")

    try:
        import smtplib
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port)
        else:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()

        server.login(smtp_user, smtp_password)
        server.quit()
        print("✅ SMTP 연결 성공!")
    except Exception as e:
        print(f"❌ SMTP 연결 실패: {e}")
        print("\n문제 해결:")
        print("1. 이메일 주소와 비밀번호 확인")
        print("2. Gmail의 경우 앱 비밀번호 사용 확인")
        print("3. 방화벽에서 포트 차단 확인")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "test":
        test_smtp_connection()
    else:
        create_env_file()
