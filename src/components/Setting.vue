<template>
  <!-- Enable Audio Toggle -->
  <div class="border-2 border-gray-300 dark:border-gray-600 px-3 py-3 bg-gray-100 dark:bg-gray-800 mb-3 w-48">
    <div class="flex items-center justify-between">
      <label class="text-base font-semibold text-gray-900 dark:text-gray-100 cursor-pointer" @click="settingStore.enableAudio = !settingStore.enableAudio">
        Enable Audio
      </label>
      <button
        type="button"
        role="switch"
        :aria-checked="settingStore.enableAudio"
        @click="settingStore.enableAudio = !settingStore.enableAudio"
        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        :class="settingStore.enableAudio ? 'bg-blue-600' : 'bg-gray-300'"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
          :class="settingStore.enableAudio ? 'translate-x-6' : 'translate-x-1'"
        ></span>
      </button>
    </div>
  </div>

  <div class="border-2 border-gray-300 dark:border-gray-600 px-3 py-3 bg-gray-100 dark:bg-gray-800 mb-3">
    <button class="w-full text-left flex items-center gap-2 text-gray-900 dark:text-gray-100" @click="toggleVlmParams">
      <h2>VLM Parameters</h2>
      <span class="ml-auto">{{ showVlmParams ? '▲' : '▼' }}</span>
    </button>
    <Transition name="fade-slide">
    <div v-show="showVlmParams" class="mt-3">
      <div class="grid lg:grid-cols-3 gap-4 rounded-md">
        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Chunk 설정</h2>
          <label class="block text-sm mb-1 text-gray-700 dark:text-gray-300">Chunk Size</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">동영상 추론에서 분할 단위를 설정합니다.</p>
          <select v-model.number="settingStore.chunk" class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3">
            <option value=-1>{{ settingStore.language === 'ko' ? '자동 지정' : 'Auto' }}</option>
            <option value=0>{{ settingStore.language === 'ko' ? 'Chunk 없음' : 'No chunking' }}</option>
            <option value=5>5 {{ settingStore.language === 'ko' ? '초' : 'sec' }}</option>
            <option value=10>10 {{ settingStore.language === 'ko' ? '초' : 'sec' }}</option>
            <option value=20>20 {{ settingStore.language === 'ko' ? '초' : 'sec' }}</option>
            <option value=30>30 {{ settingStore.language === 'ko' ? '초' : 'sec' }}</option>
            <option value=60>1 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
            <option value=120>2 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
            <option value=300>5 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
            <option value=600>10 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
            <option value=1200>20 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
            <option value=1800>30 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
          </select>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Caption Summarization Prompt</h2>
          <textarea v-model="settingStore.captionPrompt" rows="6" class="w-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md p-3"></textarea>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">이미지가 업로드되면 자동으로 이미지 전용 프롬프트로 변경되고, 동영상만 있을 때는 동영상 전용 프롬프트로 표시됩니다.</p>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Summary Aggregation Prompt</h2>
          <textarea v-model="settingStore.aggregationPrompt" rows="6"
            class="w-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md p-3"></textarea>
          <p class="text-xs text-gray-500 mt-2">이미지가 업로드되면 자동으로 이미지 전용 프롬프트로 변경되고, 동영상만 있을 때는 동영상 전용 프롬프트로 표시됩니다.</p>
        </section>
      </div>

      <div class="grid lg:grid-cols-3 gap-4 mt-4 rounded-md">
        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">num_frames_per_chunk</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">The number of frames to choose from chunk</p>
          <input v-model.number="settingStore.nfmc" type="number" min="0" max="128" step="1"
            @blur="clampValue('nfmc', 128, 0)"
            class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3" />
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">VLM Input Width</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Provide VLM frame's width details</p>
          <input v-model.number="settingStore.frameWidth" type="number" min="0" max="4096" step="1"
            @blur="clampValue('frameWidth', 4096, 0)"
            class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3" />
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">VLM Input Height</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Provide VLM frame's height details</p>
          <input v-model.number="settingStore.frameHeight" type="number" min="0" max="4096" step="1"
            @blur="clampValue('frameHeight', 4096, 0)"
            class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3" />
        </section>
      </div>

      <div class="grid lg:grid-cols-3 gap-4 mt-4 rounded-md">
        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Top-k</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">The number of highest probability vocabulary tokens to keep for
            top-k-filtering</p>
          <input v-model.number="settingStore.topk" type="number" min="1" max="1000" step="1"
            @blur="clampValue('topk', 1000, 1)"
            class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3" />
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Top-p</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">The top-p sampling mass used for text generation. The top-p value
            determines the probability mass that is sampled at sampling time. For example, if top_p = 0.2, only the most
            likely tokens (summing to 0.2 cumulative probability) will be sampled. It is not recommended to modify both
            temperature and top_p in the same call.</p>
          <div>
            <input v-model.number="settingStore.topp" type="number" min="0" max="1" step="0.1"
              @blur="clampValue('topp', 1, 0)"
              class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-20 mt-3 text-center" />
            <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="reset_TopP">↺</button>
          </div>
          
          <div class="flex items-end h-10">
            <input v-model.number="settingStore.topp" type="range" min="0" max="1" step="0.05"
              class="w-11/12 mx-auto border-gray-300 dark:border-gray-600" />
          </div>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Temperature</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">The sampling temperature to use for text generation. The higher the
            temperature value is, the less deterministic the output text will be. It is not recommended to modify both
            temperature and top_p in the same call.</p>
          <div>
            <input v-model.number="settingStore.temp" type="number" min="0" max="1" step="0.1"
              @blur="clampValue('temp', 1, 0)"
              class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-20 mt-3 text-center" />
            <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="reset_Temperature">↺</button>
          </div>
          
          <div class="flex items-end h-10">
            <input v-model.number="settingStore.temp" type="range" min="0" max="1" step="0.05"
              class="w-11/12 mx-auto border-gray-300 dark:border-gray-600" />
          </div>
        </section>
      </div>

      <div class="grid lg:grid-cols-2 gap-4 mt-4 rounded-md">
        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <div><h2 class="font-semibold text-gray-900 dark:text-gray-100">Max Tokens</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">The maximum number of tokens to generate in any given call. Note that
            the
            model is not aware of this value, and generation will simply stop at the number of tokens specified.</p>
            </div>

            <div class="ml-auto">
              <input v-model.number="settingStore.maxTokens" type="number" min="1" max="1024" step="1"
                @blur="clampValue('maxTokens', 1024, 1)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-[70%] text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="reset_MaxTokens">↺</button>
            </div>
          </div>
        
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-8 text-center">1</span>
            <input v-model.number="settingStore.maxTokens" type="range" min="1" max="1024" step="1"
              class="w-11/12 mx-auto border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-12 text-center">1024</span>
          </div>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">seed</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Seed value to use for sampling. Repeated requests with the same seed and
            parameters should return the same result.</p>
          <input v-model.number="settingStore.seed" type="number" min="1" max="4294967295" step="1"
            @blur="clampValue('seed', 4294967295, 1)"
            class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3" />
        </section>
      </div>
    </div>
    </Transition>
  </div>

  <div class="border-2 border-gray-300 dark:border-gray-600 px-3 py-3 bg-gray-100 dark:bg-gray-800">
    <button class="w-full text-left flex items-center gap-2 text-gray-900 dark:text-gray-100" @click="toggleRAGParams">
      <h2>RAG Parameters</h2>
      <span class="ml-auto">{{ showRAGParams ? '▲' : '▼' }}</span>
    </button>

    <!--Summarize Parameters-->
    <Transition name="fade-slide">
    <div v-show="showRAGParams" class="mt-3 border-2 border-gray-300 dark:border-gray-600">
      <button class="w-full text-left rounded-md px-3 py-2 flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"  @click="toggleSUMMARYParams">
        <span>Summarize Parameters</span>
        <span class="ml-auto">{{ showSUMMARYParams ? '▲' : '▼' }}</span>
      </button>
      <Transition name="fade-scale">
      <div v-show="showSUMMARYParams" class="mt-3 m-3">
        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Summarize Top P</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The top-p sampling mass used for summarization. Determines the probability mass that is sampled.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.S_TopP" type="number" min="0" max="1" step="0.05"
                @blur="clampValue('S_TopP', 1, 0)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetS_TopP">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.S_TopP" type="range" min="0" max="1" step="0.05"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">1</span>
          </div>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Summarize Temperature</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The sampling temperature to use for summarization. Higher values make the output less deterministic.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.S_TEMPERATURE" type="number" min="0" max="1" step="0.05"
                @blur="clampValue('S_TEMPERATURE', 1, 0)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetS_TEMPERATURE">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.S_TEMPERATURE" type="range" min="0" max="1" step="0.05"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">1</span>
          </div>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Summarize Max Tokens</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The maximum number of tokens to generate for summarization.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.SMAX_TOKENS" type="number" min="1" max="10240" step="1"
                @blur="clampValue('SMAX_TOKENS', 10240, 1)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetSMAX_TOKENS">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.SMAX_TOKENS" type="range" min="1" max="10240" step="1"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-12 text-center">10240</span>
          </div>
        </section>
      </div>
      </Transition>
    </div>
    </Transition>

    <!-- Chat parameters-->
    <Transition name="fade-slide">
    <div v-show="showRAGParams" class="mt-3 border-2 border-gray-300 dark:border-gray-600">
      <button class="w-full text-left rounded-md px-3 py-2 flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"  @click="toggleChatParams">
        <span>Chat Parameters</span>
        <span class="ml-auto">{{ showChatParams ? '▲' : '▼' }}</span>
      </button>
      <Transition name="fade-scale">
      <div v-show="showChatParams" class="mt-3 m-3">
        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Chat Top P</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The top-p sampling mass used for chat. Determines the probability mass that is sampled.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.C_TopP" type="number" min="0" max="1" step="0.05"
                @blur="clampValue('C_TopP', 1, 0)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetC_TopP">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.C_TopP" type="range" min="0" max="1" step="0.05"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">1</span>
          </div>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Chat Temperature</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The sampling temperature to use for chat. Higher values make the output less deterministic.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.C_TEMPERATURE" type="number" min="0" max="1" step="0.05"
                @blur="clampValue('C_TEMPERATURE', 1, 0)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetC_TEMPERATURE">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.C_TEMPERATURE" type="range" min="0" max="1" step="0.05"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">1</span>
          </div>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Chat Max Tokens</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The maximum number of tokens to generate for chat.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.C_MAX_TOKENS" type="number" min="1" max="10240" step="1"
                @blur="clampValue('C_MAX_TOKENS', 10240, 1)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetC_MAX_TOKENS">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.C_MAX_TOKENS" type="range" min="1" max="10240" step="1"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-12 text-center">10240</span>
          </div>
        </section>
      </div>
      </Transition>
    </div>
    </Transition>

    <!-- Alert Parameters -->
    <Transition name="fade-slide">
    <div v-show="showRAGParams" class="mt-3 border-2 border-gray-300 dark:border-gray-600">
      <button class="w-full text-left rounded-md px-3 py-2 flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"  @click="toggleAlertParams">
        <span>Alert Parameters</span>
        <span class="ml-auto">{{ showAlertParams ? '▲' : '▼' }}</span>
      </button>
      <Transition name="fade-scale">
      <div v-show="showAlertParams" class="mt-3 m-3">
        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Alert Top P</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The top-p sampling mass used for alerts. Determines the probability mass that is sampled.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.A_TopP" type="number" min="0" max="1" step="0.05"
                @blur="clampValue('A_TopP', 1, 0)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetA_TopP">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.A_TopP" type="range" min="0" max="1" step="0.05"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">1</span>
          </div>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Alert Temperature</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The sampling temperature to use for alerts. Higher values make the output less deterministic.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.A_TEMPERATURE" type="number" min="0" max="1" step="0.05"
                @blur="clampValue('A_TEMPERATURE', 1, 0)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetA_TEMPERATURE">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.A_TEMPERATURE" type="range" min="0" max="1" step="0.05"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">1</span>
          </div>
        </section>

        <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
          <div class="flex items-center gap-2">
            <label>
              <h2 class="font-semibold text-gray-900 dark:text-gray-100">Alert Max Tokens</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">The maximum number of tokens to generate for alerts.</p>
            </label>
            <div class="ml-auto">
              <input v-model.number="settingStore.A_MAX_TOKENS" type="number" min="1" max="10240" step="1"
                @blur="clampValue('A_MAX_TOKENS', 10240, 1)"
                class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 text-center" />
              <button class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-7" @click="resetA_MAX_TOKENS">↺</button>
            </div>
          </div>
          <div class="flex items-end h-10">
            <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0</span>
            <input v-model.number="settingStore.A_MAX_TOKENS" type="range" min="1" max="10240" step="1"
              class="w-full border-gray-300 dark:border-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 w-12 text-center">10240</span>
          </div>
        </section>
      </div>
      </Transition>
    </div>
    </Transition>

    <!--Batch Size-->
    <div class="grid lg:grid-cols-1 gap-4 rounded-md, mt-3">
      <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
        <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Summarize Batch Size</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Batch size for summarization.</p>
          <input v-model.number="settingStore.batch" type="number" min="1" max="1024" step="1"
            @blur="clampValue('batch', 1024, 1)"
            class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3" />
      </section>
    </div>

    <!-- RAG settings -->
    <div class="grid lg:grid-cols-2 gap-4 rounded-md, mt-3">
      <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
        <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">RAG Batch Size</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Batch size for RAG processing.</p>
          <input v-model.number="settingStore.RAG_batch" type="number" min="1" max="1024" step="1"
            @blur="clampValue('RAG_batch', 1024, 1)"
            class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3" />
      </section>
      <section class="rounded-2xl border-2 border-gray-300 dark:border-gray-600 px-2 py-3 min-w-[220px] bg-white dark:bg-gray-700">
        <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">RAG Top K</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">The number of highest probability vocabulary tokens to keep for RAG top-k-filtering.</p>
          <input v-model.number="settingStore.RAG_topk" type="number" min="1" max="1024" step="1"
            @blur="clampValue('RAG_topk', 1024, 1)"
            class="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 w-full mt-3" />
      </section>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useSettingStore } from '@/stores/settingStore.js';

const settingStore = useSettingStore();

//VLM parameters
const showVlmParams = ref(true);
const toggleVlmParams = () => showVlmParams.value = !showVlmParams.value;

// RAG parameters are stored in Pinia; local refs removed.

// Toggle states
const showRAGParams = ref(true);
const showSUMMARYParams = ref(false);
const showChatParams = ref(false);
const showAlertParams = ref(false);

// Toggle functions
const toggleRAGParams = () => showRAGParams.value = !showRAGParams.value;
const toggleSUMMARYParams = () => showSUMMARYParams.value = !showSUMMARYParams.value;
const toggleChatParams = () => showChatParams.value = !showChatParams.value;
const toggleAlertParams = () => showAlertParams.value = !showAlertParams.value;

// 공통 reset 함수
const resetParameter = (paramName, defaultValue) => {
  settingStore[paramName] = defaultValue;
};

// 값 범위 제한 함수 (blur 이벤트에서 호출 - 입력 완료 후에만 검증)
const clampValue = (paramName, maxValue, minValue = null) => {
  const currentValue = settingStore[paramName];
  // 값이 null, undefined, 빈 문자열, NaN인 경우 처리
  if (currentValue === null || currentValue === undefined || currentValue === '' || isNaN(currentValue)) {
    if (minValue !== null) {
      settingStore[paramName] = minValue;
    } else {
      settingStore[paramName] = 0;
    }
    return;
  }
  
  const numValue = Number(currentValue);
  if (isNaN(numValue)) {
    // 숫자가 아닌 경우 최소값 또는 0으로 설정
    if (minValue !== null) {
      settingStore[paramName] = minValue;
    } else {
      settingStore[paramName] = 0;
    }
    return;
  }
  
  if (numValue > maxValue) {
    settingStore[paramName] = maxValue;
  } else if (minValue !== null && numValue < minValue) {
    settingStore[paramName] = minValue;
  }
};

// Reset 함수들
const reset_TopP = () => resetParameter('topp', 1.0);
const reset_Temperature = () => resetParameter('temp', 0.4);
const reset_MaxTokens = () => resetParameter('maxTokens', 512);
const resetS_TopP = () => resetParameter('S_TopP', 0.7);
const resetS_TEMPERATURE = () => resetParameter('S_TEMPERATURE', 0.2);
const resetSMAX_TOKENS = () => resetParameter('SMAX_TOKENS', 2048);
const resetC_TopP = () => resetParameter('C_TopP', 0.7);
const resetC_TEMPERATURE = () => resetParameter('C_TEMPERATURE', 0.2);
const resetC_MAX_TOKENS = () => resetParameter('C_MAX_TOKENS', 2048);
const resetA_TopP = () => resetParameter('A_TopP', 0.7);
const resetA_TEMPERATURE = () => resetParameter('A_TEMPERATURE', 0.2);
const resetA_MAX_TOKENS = () => resetParameter('A_MAX_TOKENS', 2048);
</script>

<style scoped>
.fade-slide-enter-active, .fade-slide-leave-active { transition: all .28s cubic-bezier(.4,0,.2,1); }
.fade-slide-enter-from, .fade-slide-leave-to { opacity:0; transform: translateY(-6px); }
.fade-scale-enter-active, .fade-scale-leave-active { transition: all .25s ease; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity:0; transform: scale(.96); }
/* 메뉴 토글 버튼 포커스 테두리 제거 */
button:focus, button:focus-visible { outline: none; box-shadow: none; }
</style>
