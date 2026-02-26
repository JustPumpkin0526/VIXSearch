<template>
  <aside :class="[collapsed ? 'w-[112px]' : 'w-[240px]', ' h-full shrink-0 border-r bg-gray-100 dark:bg-gray-950 border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-between relative transition-all duration-200']">
    <!-- 로고 -->
    <div class="flex items-center gap-3 cursor-pointer mb-6 overflow-hidden" @click="goToVideoList" :class="collapsed ? 'justify-center' : ''">
      <img :src="logoUrl" alt="Intellivix Logo" class="h-12 w-auto object-contain flex-shrink-0" />
      <h1 v-if="!collapsed" class="text-2xl font-bold text-vix-primary dark:text-white whitespace-nowrap flex-shrink-0">VIXScope</h1>
    </div>

    <nav class="flex flex-col flex-1 gap-2">
      <RouterLink
        to="/management"
        :class="[
          'flex items-center rounded-md py-3 relative overflow-hidden transform transition-all duration-200 group hover:shadow hover:bg-white dark:hover:bg-gray-800 active:scale-[0.97]',
          collapsed ? 'justify-center' : 'px-4',
          isActive('/management')
        ]">
        <img
          :src="storageIcon"
          alt="Management"
          :class="['w-6 h-6 object-contain', collapsed ? '' : 'flex-shrink-0', 'dark:brightness-0 dark:invert']"
        />
        <span v-if="!collapsed" class="ml-3 transition-opacity duration-200 text-lg text-gray-700 dark:text-white overflow-hidden whitespace-nowrap">{{ tSidebar.management }}</span>
      </RouterLink>
      <RouterLink
        to="/search"
        :class="[
          'flex items-center rounded-md py-3 relative overflow-hidden transform transition-all duration-200 group hover:shadow hover:bg-white dark:hover:bg-gray-800 active:scale-[0.97]',
          collapsed ? 'justify-center' : 'px-4',
          isActive('/search')
        ]">
        <img
          :src="searchIcon"
          alt="Search"
          :class="['w-6 h-6 object-contain', collapsed ? '' : 'flex-shrink-0', 'dark:brightness-0 dark:invert']"
        />
        <span v-if="!collapsed" class="ml-3 transition-opacity duration-200 text-lg text-gray-700 dark:text-white overflow-hidden whitespace-nowrap">{{ tSidebar.search }}</span>
      </RouterLink>
      <RouterLink
        to="/summarize"
        :class="[
          'flex items-center rounded-md py-3 relative overflow-hidden transform transition-all duration-200 group hover:shadow hover:bg-white dark:hover:bg-gray-800 active:scale-[0.97]',
          collapsed ? 'justify-center' : 'px-4',
          isActive('/summarize')
        ]">
        <svg viewBox="0 0 24 24" :class="['w-6 h-6 icon-base text-gray-700 dark:text-white', collapsed ? '' : 'flex-shrink-0']">
          <rect x="3" y="4" width="18" height="16" rx="2" ry="2" stroke="currentColor" fill="none" />
          <line x1="7" y1="8" x2="17" y2="8" stroke="currentColor" />
          <line x1="7" y1="12" x2="13" y2="12" stroke="currentColor" />
          <line x1="7" y1="16" x2="11" y2="16" stroke="currentColor" />
        </svg>
        <span v-if="!collapsed" class="ml-3 transition-opacity duration-200 text-lg text-gray-700 dark:text-white overflow-hidden whitespace-nowrap">{{ tSidebar.summarize }}</span>
      </RouterLink>
      <RouterLink
        to="/report"
        :class="[
          'flex items-center rounded-md py-3 relative overflow-hidden transform transition-all duration-200 group hover:shadow hover:bg-white dark:hover:bg-gray-800 active:scale-[0.97]',
          collapsed ? 'justify-center' : 'px-4',
          isActive('/report')
        ]">
        <svg viewBox="0 0 24 24" :class="['w-6 h-6 icon-base text-gray-700 dark:text-white', collapsed ? '' : 'flex-shrink-0']">
          <path d="M4 19V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" stroke="currentColor" fill="none" />
          <polyline points="14 3 14 8 19 8" stroke="currentColor" fill="none" />
          <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" />
          <line x1="8" y1="17" x2="12" y2="17" stroke="currentColor" />
        </svg>
        <span v-if="!collapsed" class="ml-3 transition-opacity duration-200 text-lg text-gray-700 dark:text-white overflow-hidden whitespace-nowrap">{{ tSidebar.report }}</span>
      </RouterLink>
      <!-- Event Reviewer 메뉴 (비활성화) -->
      <!-- <RouterLink
        to="/event-reviewer"
        :class="[
          'flex items-center rounded-md py-3 relative overflow-hidden transform transition-all duration-200 group hover:shadow hover:bg-white dark:hover:bg-gray-800 active:scale-[0.97]',
          collapsed ? 'justify-center' : 'px-4',
          isActive('/event-reviewer')
        ]">
        <svg viewBox="0 0 24 24" :class="['w-6 h-6 icon-base text-gray-700 dark:text-white', collapsed ? '' : 'flex-shrink-0']">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" fill="none" />
        </svg>
        <span v-if="!collapsed" class="ml-3 transition-opacity duration-200 text-lg text-gray-700 dark:text-white overflow-hidden whitespace-nowrap">{{ tSidebar.eventReviewer }}</span>
      </RouterLink> -->
      <!-- CV Event Detector 메뉴 (비활성화) -->
      <!-- <RouterLink
        to="/cv-event-detector"
        :class="[
          'flex items-center rounded-md py-3 relative overflow-hidden transform transition-all duration-200 group hover:shadow hover:bg-white dark:hover:bg-gray-800 active:scale-[0.97]',
          collapsed ? 'justify-center' : 'px-4',
          isActive('/cv-event-detector')
        ]">
        <svg viewBox="0 0 24 24" :class="['w-6 h-6 icon-base text-gray-700 dark:text-white', collapsed ? '' : 'flex-shrink-0']">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" fill="none" />
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" fill="none" />
          <polyline points="21 15 16 10 5 21" stroke="currentColor" fill="none" />
        </svg>
        <span v-if="!collapsed" class="ml-3 transition-opacity duration-200 text-lg text-gray-700 dark:text-white overflow-hidden whitespace-nowrap">{{ tSidebar.cvEventDetector }}</span>
      </RouterLink> -->

      <div :class="['absolute left-6 right-6 bottom-[1vh] flex flex-col space-y-3', collapsed ? 'items-center' : 'items-start']">
        <!-- Collapse button positioned with the bottom group -->
        <button
          :class="[
            'w-full flex items-center justify-center',
            collapsed ? 'px-3 py-3' : 'px-4 py-3',
            'bg-white dark:bg-gray-800',
            'rounded-lg border border-gray-200 dark:border-gray-700',
            'hover:bg-gray-50 dark:hover:bg-gray-700',
            'hover:border-gray-300 dark:hover:border-gray-600',
            'active:scale-[0.97]',
            'transition-all duration-200',
            'group shadow-sm hover:shadow-md'
          ]"
          @click="toggleCollapse"
          aria-label="Toggle sidebar"
          :aria-expanded="(!collapsed).toString()"
          :title="collapsed ? tSidebar.expandSidebar : tSidebar.collapseSidebar"
        >
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
            :class="[
              'w-5 h-5 text-gray-600 dark:text-gray-300',
              'group-hover:text-vix-primary dark:group-hover:text-vix-primary',
              'transition-all duration-200',
              collapsed ? 'rotate-180' : 'rotate-0'
            ]"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span 
            v-if="!collapsed" 
            class="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-vix-primary dark:group-hover:text-vix-primary transition-colors duration-200 overflow-hidden whitespace-nowrap"
          >
            {{ tSidebar.collapse }}
          </span>
        </button>

        <!-- 사용자 프로필 (최하단) -->
        <div class="w-full mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
          <template v-if="userId">
            <!-- 프로필 (펼쳐진 상태) -->
            <div v-if="!collapsed" class="flex flex-col gap-3">
              <div 
                class="flex items-center gap-3 px-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md p-2 transition-colors"
                @click="toggleProfileMenu"
                ref="profileBlockRef"
              >
                <!-- 프로필 이미지 (이니셜 아바타) -->
                <div 
                  class="profile-avatar flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md hover:scale-110 transition-transform overflow-hidden aspect-square"
                  :class="profileImageUrl ? 'bg-white' : 'bg-gradient-to-br from-vix-primary to-blue-600'"
                >
                  <img 
                    v-if="profileImageUrl" 
                    :src="profileImageUrl" 
                    :alt="userId"
                    class="w-full h-full object-cover aspect-square"
                  />
                  <span v-else>{{ getUserInitial(userId) }}</span>
                </div>
                <div class="flex-1 min-w-0 overflow-hidden">
                  <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate overflow-hidden">{{ userId }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 overflow-hidden whitespace-nowrap">{{ tSidebar.user }}</div>
                </div>
              </div>
            </div>
            <!-- 프로필 (접힌 상태) -->
            <div v-else class="flex justify-center px-2 py-2">
              <div 
                class="profile-avatar w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md cursor-pointer hover:scale-110 transition-transform overflow-hidden aspect-square"
                :class="profileImageUrl ? 'bg-white' : 'bg-gradient-to-br from-vix-primary to-blue-600'"
                @click="toggleProfileMenu"
                ref="profileBlockRef"
              >
                <img 
                  v-if="profileImageUrl" 
                  :src="profileImageUrl" 
                  :alt="userId"
                  class="w-full h-full object-cover aspect-square"
                />
                <span v-else>{{ getUserInitial(userId) }}</span>
              </div>
            </div>
            
            <!-- 프로필 메뉴 -->
            <Teleport to="body">
              <div 
                v-if="showContextMenuFlag" 
                class="context-menu-container fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-[9999] min-w-[160px]"
                :style="contextMenuStyle"
                @click.stop
              >
              <button 
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors overflow-hidden"
                @click="openProfileSettings"
              >
                <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-700 dark:text-white flex-shrink-0">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                </svg>
                <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.profileSettings }}</span>
              </button>
              <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button 
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors overflow-hidden"
                @click="handleSetting"
              >
                <img src="@/assets/icons/setting.png" alt="Setting" class="w-4 h-4 object-contain dark:brightness-0 dark:invert flex-shrink-0" />
                <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.setting }}</span>
              </button>
              <button 
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors overflow-hidden"
                @click="handleHelp"
              >
                <img src="@/assets/icons/help.png" alt="Help" class="w-4 h-4 object-contain dark:brightness-0 dark:invert flex-shrink-0" />
                <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.help }}</span>
              </button>
              <div v-if="isAdmin" class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button 
                v-if="isAdmin"
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors overflow-hidden"
                @click="handleAdminApproval"
              >
                <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-700 dark:text-white flex-shrink-0">
                  <path d="M12 3l7 4v5c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                </svg>
                <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.adminApproval }}</span>
              </button>
              <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button 
                class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 transition-colors overflow-hidden"
                @click="handleLogout"
              >
                <svg viewBox="0 0 24 24" class="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <polyline points="16 17 21 12 16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.logout }}</span>
              </button>
              </div>
            </Teleport>
            
            <!-- 프로필 설정 팝업 -->
            <div 
              v-if="showProfileModal" 
              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              @mousedown="(e) => handleModalBackgroundClick(e, closeProfileSettings)"
              @mouseup="(e) => handleModalBackgroundClick(e, closeProfileSettings)"
            >
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[800px] h-full max-h-[800px] mx-4">
                  <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200 overflow-hidden whitespace-nowrap">{{ tSidebar.profileSettings }}</h2>
                  <button 
                    @click="closeProfileSettings"
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" class="w-6 h-6">
                      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
                <div class="p-6">
                  <div class="flex flex-col items-center gap-4 mb-6">
                    <!-- 프로필 이미지 -->
                    <div 
                      class="relative w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-lg cursor-pointer hover:opacity-80 transition-opacity overflow-hidden aspect-square"
                      :class="profileImageUrl ? 'bg-white' : 'bg-gradient-to-br from-vix-primary to-blue-600'"
                      @click="triggerImageUpload"
                      :title="tSidebar.changeProfileImage"
                    >
                      <img 
                        v-if="profileImageUrl" 
                        :src="profileImageUrl" 
                        :alt="userId"
                        class="w-full h-full object-cover aspect-square"
                      />
                      <span v-else>{{ getUserInitial(userId) }}</span>
                      <!-- 업로드 오버레이 -->
                      <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-all flex items-center justify-center">
                        <svg v-if="!isUploadingImage" viewBox="0 0 24 24" class="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                          <polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                          <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <div v-else class="text-white text-xs">{{ tSidebar.uploading }}</div>
                      </div>
                    </div>
                    <!-- 숨겨진 파일 입력 -->
                    <input 
                      ref="profileImageInputRef"
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="handleImageUpload"
                    />
                      <div class="text-center overflow-hidden">
                        <div class="text-lg font-semibold text-gray-800 dark:text-gray-200 overflow-hidden whitespace-nowrap">{{ userId }}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 overflow-hidden whitespace-nowrap">{{ tSidebar.user }}</div>
                      </div>
                    </div>
                    
                    <!-- 프로필 정보 -->
                    <div class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 overflow-hidden whitespace-nowrap">{{ tSidebar.userId }}</label>
                        <input 
                          type="text" 
                          :value="userId" 
                          disabled
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 overflow-hidden whitespace-nowrap">{{ tSidebar.email }}</label>
                        <input 
                          type="email" 
                          v-model="userEmail"
                          :disabled="isLoadingUserInfo"
                          :placeholder="tSidebar.emailPlaceholder"
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-vix-primary focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                        />
                        <p v-if="isLoadingUserInfo" class="mt-1 text-xs text-gray-500 dark:text-gray-400 overflow-hidden whitespace-nowrap">{{ tSidebar.loadingEmail }}</p>
                      </div>
                    </div>
                  </div>
                  <div class="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                  <button 
                    @click="closeProfileSettings"
                    class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors overflow-hidden whitespace-nowrap"
                  >
                    {{ tSidebar.cancel }}
                  </button>
                  <button 
                    @click="saveProfileSettings"
                    class="px-4 py-2 text-sm font-medium text-white bg-vix-primary hover:bg-blue-700 rounded-md transition-colors overflow-hidden whitespace-nowrap"
                  >
                    {{ tSidebar.save }}
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Setting 팝업 -->
            <div 
              v-if="showSettingModal" 
              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              @mousedown="(e) => handleModalBackgroundClick(e, closeSettingModal)"
              @mouseup="(e) => handleModalBackgroundClick(e, closeSettingModal)"
            >
                <div 
                  class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
                  @click.stop
                  @mousedown.stop
                  @mouseup.stop
                >
                  <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200 overflow-hidden whitespace-nowrap">{{ tSidebar.setting }}</h2>
                  <button 
                    @click="closeSettingModal"
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" class="w-6 h-6">
                      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
                
                <!-- 카테고리 탭 -->
                <div class="flex border-b border-gray-200 dark:border-gray-700 px-6">
                  <button
                    @click="settingCategory = settingStore.language === 'ko' ? '일반' : 'General'"
                    :class="[
                      'px-4 py-3 text-sm font-medium transition-colors border-b-2 overflow-hidden',
                      settingCategory === (settingStore.language === 'ko' ? '일반' : 'General')
                        ? 'text-vix-primary border-vix-primary'
                        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                    ]"
                  >
                    <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.general }}</span>
                  </button>
                  <button
                    @click="settingCategory = settingStore.language === 'ko' ? '고급' : 'Advanced'"
                    :class="[
                      'px-4 py-3 text-sm font-medium transition-colors border-b-2 overflow-hidden',
                      settingCategory === (settingStore.language === 'ko' ? '고급' : 'Advanced')
                        ? 'text-vix-primary border-vix-primary'
                        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                    ]"
                  >
                    <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.advanced }}</span>
                  </button>
                </div>
                
                <!-- 설정 내용 -->
                <div class="flex-1 overflow-y-auto p-6">
                  <!-- 일반 설정 -->
                  <div v-if="settingCategory === (settingStore.language === 'ko' ? '일반' : 'General')" class="space-y-6">
                    <div>
                      <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 overflow-hidden whitespace-nowrap">{{ tSidebar.generalSettings }}</h3>
                      <div class="space-y-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 overflow-hidden whitespace-nowrap">{{ tSidebar.language }}</label>
                          <select 
                            v-model="settingStore.language"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-vix-primary focus:border-transparent">
                            <option value="ko">한국어</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 overflow-hidden whitespace-nowrap">{{ tSidebar.theme }}</label>
                          <select 
                            v-model="settingStore.theme"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-vix-primary focus:border-transparent"
                          >
                            <option value="light">{{ tSidebar.light }}</option>
                            <option value="dark">{{ tSidebar.dark }}</option>
                            <option value="auto">{{ tSidebar.systemSettings }}</option>
                          </select>
                        </div>
                        <div class="flex items-center justify-between">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 overflow-hidden whitespace-nowrap">{{ tSidebar.receiveNotifications }}</label>
                            <p class="text-xs text-gray-500 dark:text-gray-400 overflow-hidden">{{ tSidebar.receiveNotificationsDesc }}</p>
                          </div>
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-vix-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-vix-primary"></div>
                          </label>
                        </div>
                        <div class="flex items-center justify-between">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 overflow-hidden whitespace-nowrap">{{ tSidebar.emailNotifications }}</label>
                            <p class="text-xs text-gray-500 dark:text-gray-400 overflow-hidden">{{ tSidebar.emailNotificationsDesc }}</p>
                          </div>
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-vix-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-vix-primary"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- 고급 설정 -->
                  <div v-if="settingCategory === (settingStore.language === 'ko' ? '고급' : 'Advanced')" class="space-y-6">
                    <div>
                      <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 overflow-hidden whitespace-nowrap">{{ tSidebar.advancedSettings }}</h3>
                      <div class="space-y-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 overflow-hidden whitespace-nowrap">{{ tSidebar.apiTimeout }}</label>
                          <input 
                            type="number" 
                            value="60"
                            min="10"
                            max="300"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-vix-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 overflow-hidden whitespace-nowrap">{{ tSidebar.maxConcurrentUploads }}</label>
                          <input 
                            type="number" 
                            value="5"
                            min="1"
                            max="10"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-vix-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 overflow-hidden whitespace-nowrap">{{ tSidebar.cacheSize }}</label>
                          <input 
                            type="number" 
                            value="100"
                            min="10"
                            max="1000"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-vix-primary focus:border-transparent"
                          />
                        </div>
                        <div class="flex items-center justify-between">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 overflow-hidden whitespace-nowrap">{{ tSidebar.debugMode }}</label>
                            <p class="text-xs text-gray-500 dark:text-gray-400 overflow-hidden">{{ tSidebar.debugModeDesc }}</p>
                          </div>
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-vix-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-vix-primary"></div>
                          </label>
                        </div>
                        <div class="flex items-center justify-between">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 overflow-hidden whitespace-nowrap">{{ tSidebar.autoSave }}</label>
                            <p class="text-xs text-gray-500 dark:text-gray-400 overflow-hidden">{{ tSidebar.autoSaveDesc }}</p>
                          </div>
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer" checked>
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-vix-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-vix-primary"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <!-- 로그인 안 됨 (펼쳐진 상태) -->
            <div v-if="!collapsed" class="flex flex-col gap-2">
              <router-link class="text-sm text-gray-600 hover:text-vix-primary px-4 py-2 rounded-md hover:bg-white transition-colors flex items-center gap-2 overflow-hidden" to="/login">
                <svg viewBox="0 0 24 24" class="w-4 h-4 flex-shrink-0">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <polyline points="10 17 15 12 10 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <line x1="15" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.signIn }}</span>
              </router-link>
              <router-link class="text-sm text-gray-600 hover:text-vix-primary px-4 py-2 rounded-md hover:bg-white transition-colors flex items-center gap-2 overflow-hidden" to="/register">
                <svg viewBox="0 0 24 24" class="w-4 h-4 flex-shrink-0">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <line x1="22" y1="11" x2="16" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="overflow-hidden whitespace-nowrap">{{ tSidebar.signUp }}</span>
              </router-link>
            </div>
            <!-- 로그인 안 됨 (접힌 상태) -->
            <div v-else class="flex justify-center">
              <router-link class="text-sm text-gray-600 hover:text-vix-primary p-2 rounded-md hover:bg-white transition-colors" to="/login" :title="tSidebar.signIn">
                <svg viewBox="0 0 24 24" class="w-5 h-5">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <polyline points="10 17 15 12 10 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  <line x1="15" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </router-link>
            </div>
          </template>
        </div>
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from "vue-router";
import { useSettingStore } from '@/stores/settingStore';
import { getApiBaseUrl } from '@/utils/apiConfig';
import logoUrl from '@/assets/icons/Intellivix_logo.png';
import storageIcon from '@/assets/icons/storage.png';
import searchIcon from '@/assets/icons/search.svg';

const route = useRoute();
const router = useRouter();
const settingStore = useSettingStore();
const userId = ref("");
const userRole = ref("");
const collapsed = ref(true);
const showContextMenuFlag = ref(false);
const showProfileModal = ref(false);
const showSettingModal = ref(false);
// 현재 언어에 맞는 기본 카테고리로 초기화
const settingCategory = ref(settingStore.language === 'ko' ? '일반' : 'General'); // "일반"/"General" 또는 "고급"/"Advanced"
const contextMenuStyle = ref({});
const profileBlockRef = ref(null);
const userEmail = ref("");
const isLoadingUserInfo = ref(false);
const profileImageUrl = ref(null);
const profileImageInputRef = ref(null);
const isUploadingImage = ref(false);

// ==================== 다국어 지원 ====================
const sidebarTranslations = {
  ko: {
    search: "장면 검색",
    management: "동영상 관리",
    summarize: "동영상 요약",
    report: "보고서 관리",
    eventReviewer: "이벤트 검토",
    cvEventDetector: "CV 이벤트 감지",
    adminApproval: "관리자 승인",
    user: "사용자",
    profileSettings: "프로필 설정",
    setting: "설정",
    help: "도움말",
    logout: "로그아웃",
    signIn: "로그인",
    signUp: "회원가입",
    general: "일반",
    advanced: "고급",
    generalSettings: "일반 설정",
    advancedSettings: "고급 설정",
    language: "언어",
    theme: "테마",
    light: "라이트",
    dark: "다크",
    systemSettings: "시스템 설정",
    receiveNotifications: "알림 받기",
    receiveNotificationsDesc: "새로운 업데이트 및 알림을 받습니다",
    emailNotifications: "이메일 알림",
    emailNotificationsDesc: "중요한 알림을 이메일로 받습니다",
    apiTimeout: "API 타임아웃 (초)",
    maxConcurrentUploads: "최대 동시 업로드 수",
    cacheSize: "캐시 크기 (MB)",
    debugMode: "디버그 모드",
    debugModeDesc: "상세한 로그를 출력합니다",
    autoSave: "자동 저장",
    autoSaveDesc: "작업 내용을 자동으로 저장합니다",
    userId: "사용자 ID",
    email: "이메일",
    emailPlaceholder: "이메일을 입력하세요",
    loadingEmail: "이메일 정보를 불러오는 중...",
    cancel: "취소",
    save: "저장",
    changeProfileImage: "프로필 이미지 변경",
    uploading: "업로드 중...",
    collapse: "접기",
    expandSidebar: "사이드바 펼치기",
    collapseSidebar: "사이드바 접기"
  },
  en: {
    search: "Scene Search",
    management: "VideoManagement",
    summarize: "Summarize",
    report: "Report Management",
    eventReviewer: "Event Reviewer",
    cvEventDetector: "CV Event Detector",
    adminApproval: "Admin Approval",
    user: "User",
    profileSettings: "Profile Settings",
    setting: "Setting",
    help: "Help",
    logout: "Logout",
    signIn: "Sign in",
    signUp: "Sign up",
    general: "General",
    advanced: "Advanced",
    generalSettings: "General Settings",
    advancedSettings: "Advanced Settings",
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    systemSettings: "System Settings",
    receiveNotifications: "Receive Notifications",
    receiveNotificationsDesc: "Receive new updates and notifications",
    emailNotifications: "Email Notifications",
    emailNotificationsDesc: "Receive important notifications via email",
    apiTimeout: "API Timeout (seconds)",
    maxConcurrentUploads: "Max Concurrent Uploads",
    cacheSize: "Cache Size (MB)",
    debugMode: "Debug Mode",
    debugModeDesc: "Output detailed logs",
    autoSave: "Auto Save",
    autoSaveDesc: "Automatically save work content",
    userId: "User ID",
    email: "Email",
    emailPlaceholder: "Enter your email",
    loadingEmail: "Loading email information...",
    cancel: "Cancel",
    save: "Save",
    changeProfileImage: "Change Profile Image",
    uploading: "Uploading...",
    collapse: "Collapse",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar"
  }
};

const tSidebar = computed(() => sidebarTranslations[settingStore.language] || sidebarTranslations.ko);
const isAdmin = computed(() => userRole.value === "ADMIN");

// 언어 변경 시 settingCategory 자동 업데이트
watch(() => settingStore.language, (newLang) => {
  if (settingCategory.value === '일반' || settingCategory.value === 'General') {
    settingCategory.value = newLang === 'ko' ? '일반' : 'General';
  } else if (settingCategory.value === '고급' || settingCategory.value === 'Advanced') {
    settingCategory.value = newLang === 'ko' ? '고급' : 'Advanced';
  }
});

const isActive = (path) =>
  route.path.startsWith(path)
    ? "text-vix-primary dark:text-white font-medium bg-gradient-to-r from-white to-vix-primary/10 dark:from-gray-800 dark:to-gray-700 shadow ring-1 ring-vix-primary/30 dark:ring-gray-600"
    : "text-gray-700 dark:text-gray-200 hover:bg-gradient-to-r hover:from-white hover:to-gray-50 dark:hover:from-gray-800 dark:hover:to-gray-700";

function toggleCollapse() {
  collapsed.value = !collapsed.value;
  // 사이드바 접힘/펼침 시 컨텍스트 메뉴 닫기
  showContextMenuFlag.value = false;
}

function checkLogin() {
  userId.value = localStorage.getItem("vss_user_id") || "";
  userRole.value = localStorage.getItem("vss_user_role") || "";
  if (!userId.value) {
    userRole.value = "";
  }
}

function logout() {
  localStorage.removeItem("vss_user_id");
  localStorage.removeItem("vss_user_role");
  userId.value = "";
  userRole.value = "";
  window.dispatchEvent(new Event("vss-login"));
  router.push("/login");
}

function goToVideoList() {
  router.push("/management");
}

function getUserInitial(userId) {
  if (!userId) return "?";
  // 사용자 ID의 첫 글자를 대문자로 반환
  return userId.charAt(0).toUpperCase();
}

function toggleProfileMenu(event) {
  if (!userId.value) return;
  
  event.stopPropagation();
  
  // 메뉴가 이미 열려있으면 닫기
  if (showContextMenuFlag.value) {
    showContextMenuFlag.value = false;
    return;
  }
  
  // 다른 메뉴들에게 프로필 메뉴가 열릴 예정임을 먼저 알림 (다른 메뉴를 닫기 위해)
  window.dispatchEvent(new CustomEvent('profile-menu-opened'));
  
  // 다음 틱에서 메뉴 표시
  setTimeout(() => {
    if (!profileBlockRef.value) return;
    
    const profileRect = profileBlockRef.value.getBoundingClientRect();
    const menuWidth = 160; // min-w-[160px]
    // 메뉴 항목: 프로필 설정, Setting, Help, 관리자 승인(관리자만), 로그아웃 (각 약 40px) + 구분선 + 패딩
    const menuHeight = 170; // 실제 메뉴 높이를 더 크게 설정 (관리자 승인 메뉴 포함)
    
    // 프로필 블록 위쪽에 메뉴 표시 (간격을 더 크게)
    const x = profileRect.left + (profileRect.width / 2) - (menuWidth / 2);
    const spacing = 16; // 프로필 블록과 메뉴 사이 간격 (16px)
    const y = profileRect.top - menuHeight - spacing;
    
    // 화면 밖으로 나가지 않도록 조정
    const adjustedX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
    
    // 위쪽이 화면 밖으로 나가면 아래쪽에 표시
    let finalY = y;
    if (y < 10) {
      // 위쪽 공간이 부족하면 프로필 블록 아래에 표시
      finalY = profileRect.bottom + spacing;
    }
    
    contextMenuStyle.value = {
      left: `${adjustedX}px`,
      top: `${finalY}px`,
    };
    
    showContextMenuFlag.value = true;
  }, 0);
}

// 팝업 배경 클릭 핸들러 (드래그 방지)
let modalMouseDownPos = null;
function handleModalBackgroundClick(event, closeFunction) {
  // 모달 내용 영역을 클릭한 경우 무시
  const modalContent = event.target.closest('.bg-white, .dark\\:bg-gray-800');
  if (modalContent && modalContent !== event.currentTarget) {
    return;
  }
  
  // mousedown 위치 저장
  if (event.type === 'mousedown') {
    modalMouseDownPos = { x: event.clientX, y: event.clientY };
    return;
  }
  
  // mouseup에서 위치 비교
  if (event.type === 'mouseup' && modalMouseDownPos) {
    const distance = Math.sqrt(
      Math.pow(event.clientX - modalMouseDownPos.x, 2) + 
      Math.pow(event.clientY - modalMouseDownPos.y, 2)
    );
    // 5픽셀 이내에서만 클릭으로 간주 (드래그가 아닌 경우)
    if (distance < 5) {
      closeFunction();
    }
    modalMouseDownPos = null;
  }
}

function closeContextMenu() {
  showContextMenuFlag.value = false;
}

async function openProfileSettings() {
  closeContextMenu();
  showProfileModal.value = true;
  await loadUserInfo();
}

function closeProfileSettings() {
  showProfileModal.value = false;
  userEmail.value = ""; // 모달 닫을 때 이메일 초기화
}

// API 설정
const API_BASE_URL = getApiBaseUrl();

async function loadUserInfo() {
  if (!userId.value) return;
  
  isLoadingUserInfo.value = true;
  try {
    const response = await fetch(`${API_BASE_URL}/user/${userId.value}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        userEmail.value = data.user.email || "";
        // 프로필 이미지 URL 설정
        if (data.user.profile_image_url) {
          profileImageUrl.value = data.user.profile_image_url.startsWith('http') 
            ? data.user.profile_image_url 
            : `${API_BASE_URL}${data.user.profile_image_url}`;
        } else {
          profileImageUrl.value = null;
        }
      }
    } else {
      console.error('사용자 정보 조회 실패:', response.statusText);
    }
  } catch (error) {
    console.error('사용자 정보 조회 중 오류:', error);
  } finally {
    isLoadingUserInfo.value = false;
  }
}

async function saveProfileSettings() {
  if (!userId.value) return;
  
  if (!userEmail.value || !userEmail.value.trim()) {
    alert('이메일을 입력해주세요.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/user/${userId.value}/email`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail.value.trim()
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        alert('프로필 정보가 성공적으로 수정되었습니다!');
        closeProfileSettings();
      } else {
        alert('프로필 수정에 실패했습니다.');
      }
    } else {
      const errorData = await response.json().catch(() => ({ detail: '이메일 업데이트에 실패했습니다.' }));
      alert(errorData.detail || '이메일 업데이트에 실패했습니다.');
    }
  } catch (error) {
    console.error('이메일 업데이트 중 오류:', error);
    alert('이메일 업데이트 중 오류가 발생했습니다.');
  }
}

function handleLogout() {
  closeContextMenu();
  logout();
}

function handleSetting() {
  closeContextMenu();
  settingCategory.value = settingStore.language === 'ko' ? '일반' : 'General'; // 현재 언어에 맞는 기본값으로 설정
  showSettingModal.value = true;
}

// 외부에서 설정 모달을 열기 위한 이벤트 리스너
function handleOpenSettingsModal() {
  handleSetting();
}

window.addEventListener('open-settings-modal', handleOpenSettingsModal);

function closeSettingModal() {
  showSettingModal.value = false;
  settingCategory.value = settingStore.language === 'ko' ? '일반' : 'General'; // 모달 닫을 때 현재 언어에 맞는 기본값으로 리셋
}

function handleHelp() {
  router.push("/help");
  closeContextMenu();
  // TODO: 도움말 페이지로 이동하거나 도움말 모달 열기
  console.log('Help 클릭');
}

function handleAdminApproval() {
  router.push("/admin-approvals");
  closeContextMenu();
}

function triggerImageUpload() {
  if (profileImageInputRef.value) {
    profileImageInputRef.value.click();
  }
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  
  // 파일 타입 검증
  if (!file.type.startsWith('image/')) {
    alert(settingStore.language === 'ko' ? '이미지 파일만 업로드할 수 있습니다.' : 'Only image files can be uploaded.');
    return;
  }
  
  // 파일 크기 검증 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert(settingStore.language === 'ko' ? '이미지 파일 크기는 5MB를 초과할 수 없습니다.' : 'Image file size cannot exceed 5MB.');
    return;
  }
  
  isUploadingImage.value = true;
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/user/${userId.value}/profile-image`, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.profile_image_url) {
        profileImageUrl.value = data.profile_image_url.startsWith('http') 
          ? data.profile_image_url 
          : `${API_BASE_URL}${data.profile_image_url}`;
        alert(settingStore.language === 'ko' ? '프로필 이미지가 업로드되었습니다.' : 'Profile image has been uploaded.');
      } else {
        throw new Error(data.message || '업로드 실패');
      }
    } else {
      const errorData = await response.json().catch(() => ({ detail: '업로드 실패' }));
      throw new Error(errorData.detail || '업로드 실패');
    }
  } catch (error) {
    console.error('프로필 이미지 업로드 중 오류:', error);
    alert(settingStore.language === 'ko' 
      ? `프로필 이미지 업로드 중 오류가 발생했습니다: ${error.message}` 
      : `An error occurred while uploading profile image: ${error.message}`);
  } finally {
    isUploadingImage.value = false;
    // 파일 입력 초기화
    if (profileImageInputRef.value) {
      profileImageInputRef.value.value = '';
    }
  }
}

// 외부 클릭 시 컨텍스트 메뉴 닫기
function handleClickOutside(event) {
  // 우클릭 이벤트는 무시 (컨텍스트 메뉴가 열릴 수 있음)
  if (event.button === 2 || event.which === 3) return;
  
  // 컨텍스트 메뉴가 열려있고, 클릭한 요소가 컨텍스트 메뉴나 프로필 이미지가 아닌 경우에만 닫기
  if (showContextMenuFlag.value) {
    const isContextMenu = event.target.closest('.context-menu-container');
    const isProfileImage = event.target.closest('.profile-avatar');
    const isProfileBlock = event.target.closest('[ref="profileBlockRef"]') || event.target.closest('.profile-avatar');
    
    if (!isContextMenu && !isProfileImage && !isProfileBlock) {
      closeContextMenu();
    }
  }
}

onMounted(() => {
  checkLogin();
  // 로그인 상태 확인 시 프로필 이미지도 로드
  if (userId.value) {
    loadUserInfo();
  }
  window.addEventListener("management", checkLogin);
  window.addEventListener("vss-login", () => {
    checkLogin();
    if (userId.value) {
      loadUserInfo();
    }
  });
  // 이벤트 리스너 등록
  document.addEventListener("click", handleClickOutside);
  // 다른 메뉴가 열렸을 때 프로필 메뉴 닫기
  window.addEventListener('video-context-menu-opened', closeContextMenu);
});

onUnmounted(() => {
  window.removeEventListener('video-context-menu-opened', closeContextMenu);
  window.removeEventListener('open-settings-modal', handleOpenSettingsModal);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped>
/* Optional subtle fade-slide for future label transitions */
.fade-slide-enter-active, .fade-slide-leave-active { transition: all .2s ease; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity:0; transform: translateX(-4px); }
.fade-slide-enter-to, .fade-slide-leave-from { opacity:1; transform: translateX(0); }
/* 인라인 SVG 공통 스타일 */
.icon-base {
  stroke: currentColor;
  fill: none;
  width: 1.5rem; /* Fixed size */
  height: 1.5rem; /* Fixed size */
}
/* 설정 PNG 활성시 파란색 계열 필터 */
.png-active { filter: brightness(0) saturate(100%) invert(32%) sepia(82%) saturate(1820%) hue-rotate(191deg) brightness(95%) contrast(94%); }
</style>
