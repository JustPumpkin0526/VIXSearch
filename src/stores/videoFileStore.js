import { defineStore } from 'pinia';

/**
 * 동영상 File 객체를 공유하는 Store
 * 각 메뉴(Summarize, Search, Management)에서 File 객체를 재사용할 수 있도록 함
 */
export const useVideoFileStore = defineStore('videoFile', {
  state: () => ({
    /**
     * @type {Map<string, File>}
     * 키: video.id 또는 video.dbId (문자열)
     * 값: File 객체
     */
    fileCache: new Map()
  }),

  getters: {
    /**
     * 동영상 ID로 File 객체 가져오기
     * @param {string|number} videoId - 동영상 ID 또는 dbId
     * @returns {File|null} File 객체 또는 null
     */
    getFile: (state) => (videoId) => {
      if (videoId == null) return null;
      const key = String(videoId);
      return state.fileCache.get(key) || null;
    },

    /**
     * 동영상 객체로 File 객체 가져오기
     * @param {Object} video - 동영상 객체
     * @returns {File|null} File 객체 또는 null
     */
    getFileByVideo: (state) => (video) => {
      if (!video) return null;
      const videoId = video.dbId || video.id;
      if (videoId == null) return null;
      const key = String(videoId);
      return state.fileCache.get(key) || null;
    },

    /**
     * 캐시된 File 객체 개수
     * @returns {number}
     */
    cacheSize: (state) => state.fileCache.size
  },

  actions: {
    /**
     * File 객체 저장
     * @param {string|number} videoId - 동영상 ID 또는 dbId
     * @param {File} file - File 객체
     */
    setFile(videoId, file) {
      if (videoId == null || !(file instanceof File)) {
        return;
      }
      const key = String(videoId);
      this.fileCache.set(key, file);
    },

    /**
     * 동영상 객체로 File 객체 저장
     * @param {Object} video - 동영상 객체
     * @param {File} file - File 객체
     */
    setFileByVideo(video, file) {
      if (!video || !(file instanceof File)) {
        return;
      }
      const videoId = video.dbId || video.id;
      if (videoId == null) return;
      this.setFile(videoId, file);
    },

    /**
     * File 객체 삭제
     * @param {string|number} videoId - 동영상 ID 또는 dbId
     */
    removeFile(videoId) {
      if (videoId == null) return;
      const key = String(videoId);
      this.fileCache.delete(key);
    },

    /**
     * 동영상 객체로 File 객체 삭제
     * @param {Object} video - 동영상 객체
     */
    removeFileByVideo(video) {
      if (!video) return;
      const videoId = video.dbId || video.id;
      if (videoId == null) return;
      this.removeFile(videoId);
    },

    /**
     * 여러 동영상의 File 객체 일괄 저장
     * @param {Array<Object>} videos - 동영상 객체 배열 (file 속성 포함)
     */
    setFilesFromVideos(videos) {
      if (!Array.isArray(videos)) return;
      videos.forEach(video => {
        if (video && video.file instanceof File) {
          this.setFileByVideo(video, video.file);
        }
      });
    },

    /**
     * 모든 File 객체 삭제
     */
    clearAll() {
      this.fileCache.clear();
    },

    /**
     * 특정 동영상 ID 목록의 File 객체만 삭제
     * @param {Array<string|number>} videoIds - 삭제할 동영상 ID 배열
     */
    clearFiles(videoIds) {
      if (!Array.isArray(videoIds)) return;
      videoIds.forEach(id => {
        if (id != null) {
          this.removeFile(id);
        }
      });
    }
  }
});
