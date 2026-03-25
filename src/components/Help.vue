<template>
  <div class="w-full min-h-screen bg-gradient-to-br from-gray-200 to-gray-300 via-gray-100 dark:from-gray-950 dark:to-gray-900 dark:via-gray-950 p-10">
    <div class="max-w-6xl mx-auto">
      <!-- 헤더 -->
      <header class="mb-8">
        <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-400/40 dark:border-blue-400/60 w-fit mb-4">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
          <span class="text-[11px] font-semibold tracking-wide text-blue-600 dark:text-blue-400 uppercase">
            {{ t.helpCenter }}
          </span>
        </div>
        <h1 class="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-2">{{ t.title }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ t.subtitle }}</p>
      </header>

      <!-- 목차 네비게이션 -->
      <nav class="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-8 shadow-md sticky top-4 z-10">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{{ t.tableOfContents }}</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a 
            v-for="section in sections" 
            :key="section.id"
            :href="`#${section.id}`"
            class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
            @click.prevent="scrollToSection(section.id)"
          >
            {{ section.title }}
          </a>
        </div>
      </nav>

      <!-- 메인 콘텐츠 -->
      <div class="space-y-8">
        <!-- 시작하기 -->
        <section id="getting-started" class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-3">
            <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {{ t.gettingStarted.title }}
          </h2>
          <div class="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 class="font-semibold text-lg mb-2">{{ t.gettingStarted.step1.title }}</h3>
              <p class="mb-2">{{ t.gettingStarted.step1.description }}</p>
              <ul class="list-disc list-inside ml-4 space-y-1 text-sm">
                <li>{{ t.gettingStarted.step1.item1 }}</li>
                <li>{{ t.gettingStarted.step1.item2 }}</li>
                <li>{{ t.gettingStarted.step1.item3 }}</li>
              </ul>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-2">{{ t.gettingStarted.step2.title }}</h3>
              <p>{{ t.gettingStarted.step2.description }}</p>
            </div>
          </div>
        </section>

        <!-- Search 메뉴 가이드 -->
        <section id="search-guide" class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-3">
            <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" stroke="currentColor" fill="none" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" />
            </svg>
            {{ t.searchGuide.title }}
          </h2>
          <div class="space-y-6">
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.searchGuide.upload.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.searchGuide.upload.description }}</p>
              <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-3">
                <ul class="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>{{ t.searchGuide.upload.method1 }}</li>
                  <li>{{ t.searchGuide.upload.method2 }}</li>
                  <li>{{ t.searchGuide.upload.method3 }}</li>
                </ul>
              </div>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.searchGuide.manage.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.searchGuide.manage.description }}</p>
              <ul class="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                <li>{{ t.searchGuide.manage.item1 }}</li>
                <li>{{ t.searchGuide.manage.item2 }}</li>
                <li>{{ t.searchGuide.manage.item3 }}</li>
              </ul>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.searchGuide.search.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.searchGuide.search.description }}</p>
              <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-3">
                <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t.searchGuide.search.step1 }}</p>
                <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t.searchGuide.search.step2 }}</p>
                <p class="text-sm text-gray-700 dark:text-gray-300">{{ t.searchGuide.search.step3 }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Summarize 메뉴 가이드 -->
        <section id="summarize-guide" class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-3">
            <svg class="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="16" rx="2" ry="2" stroke="currentColor" fill="none" />
              <line x1="7" y1="8" x2="17" y2="8" stroke="currentColor" />
              <line x1="7" y1="12" x2="13" y2="12" stroke="currentColor" />
            </svg>
            {{ t.summarizeGuide.title }}
          </h2>
          <div class="space-y-6">
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.summarizeGuide.select.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.summarizeGuide.select.description }}</p>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.summarizeGuide.summarize.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.summarizeGuide.summarize.description }}</p>
              <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-3">
                <ol class="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>{{ t.summarizeGuide.summarize.step1 }}</li>
                  <li>{{ t.summarizeGuide.summarize.step2 }}</li>
                  <li>{{ t.summarizeGuide.summarize.step3 }}</li>
                  <li>{{ t.summarizeGuide.summarize.step4 }}</li>
                </ol>
              </div>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.summarizeGuide.ask.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.summarizeGuide.ask.description }}</p>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.summarizeGuide.save.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.summarizeGuide.save.description }}</p>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.summarizeGuide.settings.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.summarizeGuide.settings.description }}</p>
            </div>
          </div>
        </section>

        <!-- Report 메뉴 가이드 -->
        <section id="report-guide" class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-3">
            <svg class="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 19V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" stroke="currentColor" fill="none" />
              <polyline points="14 3 14 8 19 8" stroke="currentColor" fill="none" />
            </svg>
            {{ t.reportGuide.title }}
          </h2>
          <div class="space-y-6">
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.reportGuide.view.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.reportGuide.view.description }}</p>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.reportGuide.create.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.reportGuide.create.description }}</p>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">{{ t.reportGuide.manage.title }}</h3>
              <p class="mb-3 text-gray-700 dark:text-gray-300">{{ t.reportGuide.manage.description }}</p>
              <ul class="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                <li>{{ t.reportGuide.manage.item1 }}</li>
                <li>{{ t.reportGuide.manage.item2 }}</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- FAQ -->
        <section id="faq" class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-3">
            <svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" fill="none" />
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" />
            </svg>
            {{ t.faq.title }}
          </h2>
          <div class="space-y-4">
            <div 
              v-for="(item, index) in t.faq.items" 
              :key="index"
              class="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0"
            >
              <h3 class="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-200">{{ item.question }}</h3>
              <p class="text-gray-700 dark:text-gray-300">{{ item.answer }}</p>
            </div>
          </div>
        </section>

        <!-- 문제 해결 -->
        <section id="troubleshooting" class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-3">
            <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ t.troubleshooting.title }}
          </h2>
          <div class="space-y-4">
            <div 
              v-for="(item, index) in t.troubleshooting.items" 
              :key="index"
              class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
            >
              <h3 class="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-200">{{ item.problem }}</h3>
              <p class="text-gray-700 dark:text-gray-300 mb-2">{{ item.solution }}</p>
              <ul v-if="item.steps" class="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 ml-4">
                <li v-for="(step, stepIndex) in item.steps" :key="stepIndex">{{ step }}</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <!-- 하단 안내 -->
      <footer class="mt-12 text-center text-gray-600 dark:text-gray-400">
        <p>{{ t.footer }}</p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSettingStore } from '@/stores/settingStore';

const settingStore = useSettingStore();

// 다국어 지원
const translations = {
  ko: {
    helpCenter: "Help Center",
    title: "사용자 가이드",
    subtitle: "VIXSearch의 모든 기능을 쉽게 배워보세요",
    tableOfContents: "목차",
    gettingStarted: {
      title: "시작하기",
      step1: {
        title: "1. 계정 생성",
        description: "VIXSearch를 사용하기 위해 먼저 계정을 생성해야 합니다.",
        item1: "회원가입 페이지에서 이메일 주소를 입력하세요",
        item2: "이메일로 전송된 인증 코드를 입력하세요",
        item3: "사용자 ID와 비밀번호를 설정하세요"
      },
      step2: {
        title: "2. 로그인",
        description: "계정이 생성되면 로그인하여 서비스를 이용할 수 있습니다."
      }
    },
    searchGuide: {
      title: "검색 (Search) 메뉴",
      upload: {
        title: "동영상 업로드",
        description: "검색할 동영상을 업로드하는 방법:",
        method1: "드래그 앤 드롭: 동영상 파일을 업로드 영역에 끌어다 놓기",
        method2: "업로드 버튼 클릭: '동영상 업로드' 버튼을 클릭하여 파일 선택",
        method3: "우측 하단 + 버튼: 화면 우측 하단의 원형 + 버튼 클릭"
      },
      manage: {
        title: "동영상 관리",
        description: "업로드된 동영상을 관리하는 방법:",
        item1: "동영상 카드 클릭: 동영상을 선택하거나 선택 해제",
        item2: "우클릭 메뉴: 동영상 카드에서 우클릭하여 확대, 요약, 검색, 삭제 등의 작업 수행",
        item3: "전체 선택: 헤더의 '전체 선택' 버튼으로 모든 동영상 선택"
      },
      search: {
        title: "장면 검색",
        description: "동영상에서 원하는 장면을 검색하는 방법:",
        step1: "검색할 동영상을 선택하세요 (하나 이상)",
        step2: "우클릭 메뉴에서 '검색'을 선택하거나, 우측 사이드바를 열어 검색창을 사용하세요",
        step3: "검색할 장면에 대한 설명을 입력하고 Enter를 누르면 원본 동영상에서 해당 구간이 재생됩니다"
      }
    },
    summarizeGuide: {
      title: "요약 (Summarize) 메뉴",
      select: {
        title: "동영상 선택",
        description: "Search 메뉴에서 요약할 동영상을 선택한 후, 우클릭 메뉴에서 '요약 진행'을 선택하면 Summarize 메뉴로 이동합니다."
      },
      summarize: {
        title: "동영상 요약",
        description: "동영상을 요약하는 방법:",
        step1: "좌측에 표시된 동영상을 확인하세요",
        step2: "우측 상단의 프롬프트 입력창에 요약 지시사항을 입력하세요 (선택사항)",
        step3: "요약 버튼을 클릭하여 요약을 시작하세요",
        step4: "요약이 완료되면 우측 채팅창에 결과가 표시됩니다"
      },
      ask: {
        title: "질문하기",
        description: "요약된 동영상에 대해 질문할 수 있습니다. 하단의 질문 입력창에 질문을 입력하고 'Ask' 버튼을 클릭하세요."
      },
      save: {
        title: "결과 저장",
        description: "요약 결과를 보고서로 저장할 수 있습니다. '결과 저장' 버튼을 클릭하면 Report 메뉴에서 확인할 수 있는 보고서가 생성됩니다."
      },
      settings: {
        title: "설정",
        description: "좌측 상단의 설정 버튼을 클릭하여 요약 성능 파라미터(온도, 토큰 수, 청크 크기 등)를 조정할 수 있습니다."
      }
    },
    reportGuide: {
      title: "보고서 (Report) 메뉴",
      view: {
        title: "보고서 조회",
        description: "저장된 모든 보고서를 목록으로 확인할 수 있습니다. 보고서를 클릭하면 상세 내용을 볼 수 있습니다."
      },
      create: {
        title: "보고서 생성",
        description: "Summarize 메뉴에서 '결과 저장' 버튼을 클릭하면 자동으로 보고서가 생성됩니다."
      },
      manage: {
        title: "보고서 관리",
        description: "보고서를 관리하는 방법:",
        item1: "보고서 뷰어: 보고서를 클릭하여 상세 내용을 확인하고, 드래그로 뷰어 크기를 조절할 수 있습니다",
        item2: "삭제: 각 보고서 카드 우측 하단의 점 3개(⋮) 버튼을 클릭하여 삭제할 수 있습니다"
      }
    },
    faq: {
      title: "자주 묻는 질문 (FAQ)",
      items: [
        {
          question: "어떤 동영상 형식을 지원하나요?",
          answer: "MP4, AVI, MOV, MKV, WEBM, FLV 형식을 지원합니다. 단, 브라우저에서 직접 재생하지 못하는 형식(AVI, MKV, FLV, WMV)은 서버 URL을 통해 재생됩니다."
        },
        {
          question: "동영상 업로드에 시간이 오래 걸립니다",
          answer: "동영상 파일 크기에 따라 업로드 시간이 달라집니다. 대용량 파일의 경우 몇 분이 걸릴 수 있습니다. 업로드 진행률을 확인할 수 있는 모달이 표시됩니다."
        },
        {
          question: "요약이 완료되지 않습니다",
          answer: "요약은 동영상 길이와 복잡도에 따라 시간이 걸릴 수 있습니다. 네트워크 연결 상태를 확인하고 잠시 기다려주세요. 문제가 지속되면 설정에서 청크 크기를 조정해보세요."
        },
        {
          question: "검색 결과가 나오지 않습니다",
          answer: "검색어를 더 구체적으로 입력하거나, 동영상에 해당 장면이 실제로 존재하는지 확인해주세요. 또한 동영상이 먼저 요약되어 있어야 검색이 더 정확합니다."
        },
        {
          question: "보고서를 삭제할 수 있나요?",
          answer: "네, 각 보고서 카드 우측 하단의 점 3개(⋮) 버튼을 클릭하여 삭제할 수 있습니다."
        }
      ]
    },
    troubleshooting: {
      title: "문제 해결",
      items: [
        {
          problem: "동영상이 재생되지 않습니다",
          solution: "다음 방법을 시도해보세요:",
          steps: [
            "브라우저를 새로고침하세요",
            "다른 브라우저에서 시도해보세요",
            "동영상 파일이 손상되지 않았는지 확인하세요",
            "지원되는 형식인지 확인하세요"
          ]
        },
        {
          problem: "로그인이 되지 않습니다",
          solution: "다음 사항을 확인하세요:",
          steps: [
            "사용자 ID와 비밀번호가 올바른지 확인하세요",
            "회원가입이 완료되었는지 확인하세요",
            "브라우저의 쿠키 및 로컬 스토리지 설정을 확인하세요"
          ]
        },
        {
          problem: "업로드가 실패합니다",
          solution: "다음 사항을 확인하세요:",
          steps: [
            "파일 크기가 너무 크지 않은지 확인하세요 (권장: 500MB 이하)",
            "네트워크 연결 상태를 확인하세요",
            "서버가 정상적으로 실행 중인지 확인하세요",
            "지원되는 파일 형식인지 확인하세요"
          ]
        },
        {
          problem: "요약 결과가 정확하지 않습니다",
          solution: "설정 메뉴에서 요약 파라미터를 조정해보세요. 온도(Temperature) 값을 낮추면 더 정확한 결과를 얻을 수 있습니다."
        }
      ]
    },
    footer: "추가 도움이 필요하신가요? 문의사항이 있으시면 관리자에게 연락해주세요."
  },
  en: {
    helpCenter: "Help Center",
    title: "User Guide",
    subtitle: "Learn all features of VIXSearch easily",
    tableOfContents: "Table of Contents",
    gettingStarted: {
      title: "Getting Started",
      step1: {
        title: "1. Create Account",
        description: "To use VIXSearch, you need to create an account first.",
        item1: "Enter your email address on the registration page",
        item2: "Enter the verification code sent to your email",
        item3: "Set your user ID and password"
      },
      step2: {
        title: "2. Login",
        description: "Once your account is created, you can log in and use the service."
      }
    },
    searchGuide: {
      title: "Search Menu",
      upload: {
        title: "Upload Videos",
        description: "How to upload videos for search:",
        method1: "Drag and Drop: Drag video files to the upload area",
        method2: "Upload Button: Click the 'Upload Video' button to select files",
        method3: "Plus Button: Click the circular + button at the bottom right"
      },
      manage: {
        title: "Manage Videos",
        description: "How to manage uploaded videos:",
        item1: "Click Video Card: Select or deselect videos",
        item2: "Right-click Menu: Right-click on video card to expand, summarize, search, or delete",
        item3: "Select All: Use the 'Select All' button in the header to select all videos"
      },
      search: {
        title: "Search Scenes",
        description: "How to search for scenes in videos:",
        step1: "Select videos to search (one or more)",
        step2: "Choose 'Search' from the right-click menu or open the right sidebar to use the search box",
        step3: "Enter a description of the scene you want to search and press Enter to play that segment in the original video"
      }
    },
    summarizeGuide: {
      title: "Summarize Menu",
      select: {
        title: "Select Videos",
        description: "Select videos to summarize in the Search menu, then choose 'Summary' from the right-click menu to go to the Summarize menu."
      },
      summarize: {
        title: "Summarize Videos",
        description: "How to summarize videos:",
        step1: "Check the videos displayed on the left",
        step2: "Enter summarization instructions in the prompt input box at the top right (optional)",
        step3: "Click the summarize button to start summarization",
        step4: "When summarization is complete, results will be displayed in the right chat window"
      },
      ask: {
        title: "Ask Questions",
        description: "You can ask questions about summarized videos. Enter your question in the question input box at the bottom and click the 'Ask' button."
      },
      save: {
        title: "Save Results",
        description: "You can save summarization results as a report. Click the 'Save Result' button to create a report that can be viewed in the Report menu."
      },
      settings: {
        title: "Settings",
        description: "Click the settings button at the top left to adjust summarization performance parameters (temperature, token count, chunk size, etc.)."
      }
    },
    reportGuide: {
      title: "Report Menu",
      view: {
        title: "View Reports",
        description: "You can view all saved reports in a list. Click on a report to see its detailed content."
      },
      create: {
        title: "Create Report",
        description: "Click the 'Save Result' button in the Summarize menu to automatically create a report."
      },
      manage: {
        title: "Manage Reports",
        description: "How to manage reports:",
        item1: "Report Viewer: Click on a report to view detailed content and resize the viewer by dragging",
        item2: "Delete: Click the three dots (⋮) button at the bottom right of each report card to delete it"
      }
    },
    faq: {
      title: "Frequently Asked Questions (FAQ)",
      items: [
        {
          question: "What video formats are supported?",
          answer: "We support MP4, AVI, MOV, MKV, WEBM, and FLV formats. However, formats that cannot be played directly in the browser (AVI, MKV, FLV, WMV) are played through server URLs."
        },
        {
          question: "Video upload takes a long time",
          answer: "Upload time varies depending on the video file size. For large files, it may take several minutes. A modal showing upload progress will be displayed."
        },
        {
          question: "Summarization is not completing",
          answer: "Summarization may take time depending on video length and complexity. Check your network connection and wait a moment. If the problem persists, try adjusting the chunk size in settings."
        },
        {
          question: "No search results appear",
          answer: "Try entering a more specific search term or check if the scene actually exists in the video. Also, videos should be summarized first for more accurate search results."
        },
        {
          question: "Can I delete reports?",
          answer: "Yes, you can delete reports by clicking the three dots (⋮) button at the bottom right of each report card."
        }
      ]
    },
    troubleshooting: {
      title: "Troubleshooting",
      items: [
        {
          problem: "Videos are not playing",
          solution: "Try the following methods:",
          steps: [
            "Refresh your browser",
            "Try a different browser",
            "Check if the video file is not corrupted",
            "Check if it's a supported format"
          ]
        },
        {
          problem: "Cannot log in",
          solution: "Check the following:",
          steps: [
            "Verify your user ID and password are correct",
            "Check if registration is complete",
            "Check your browser's cookie and local storage settings"
          ]
        },
        {
          problem: "Upload fails",
          solution: "Check the following:",
          steps: [
            "Check if the file size is not too large (recommended: under 500MB)",
            "Check your network connection",
            "Check if the server is running properly",
            "Check if it's a supported file format"
          ]
        },
        {
          problem: "Summarization results are not accurate",
          solution: "Try adjusting the summarization parameters in the settings menu. Lowering the Temperature value can yield more accurate results."
        }
      ]
    },
    footer: "Need more help? If you have any questions, please contact the administrator."
  }
};

const t = computed(() => translations[settingStore.language] || translations.ko);

// 섹션 목록
const sections = computed(() => [
  { id: 'getting-started', title: t.value.gettingStarted.title },
  { id: 'search-guide', title: t.value.searchGuide.title },
  { id: 'summarize-guide', title: t.value.summarizeGuide.title },
  { id: 'report-guide', title: t.value.reportGuide.title },
  { id: 'faq', title: t.value.faq.title },
  { id: 'troubleshooting', title: t.value.troubleshooting.title }
]);

// 섹션으로 스크롤
function scrollToSection(id) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
</script>

<style scoped>
/* 스크롤 시 부드러운 전환 */
html {
  scroll-behavior: smooth;
}
</style>

