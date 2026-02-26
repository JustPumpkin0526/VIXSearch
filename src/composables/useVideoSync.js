/**
 * 비디오 삭제 동기화 Composable
 * management.vue와 Search.vue 간의 비디오 삭제 동기화를 처리
 */

import { ref, onMounted, onBeforeUnmount } from 'vue';
import { isVideoDeleted as checkVideoDeleted } from '@/utils/videoUtils';

const EVENT_NAME = 'videos-deleted-from-management';

/**
 * 비디오 삭제 이벤트 발생
 */
export function emitVideoDeletedEvent(deletedVideoIds, deletedVideoDbIds) {
  const deletedVideoInfo = {
    ids: Array.from(deletedVideoIds),
    dbIds: Array.from(deletedVideoDbIds)
  };
  
  console.log(`[VideoSync] 삭제 이벤트 발생: ids=${deletedVideoInfo.ids.length}개, dbIds=${deletedVideoInfo.dbIds.length}개`);
  console.log(`[VideoSync] 삭제된 IDs:`, deletedVideoInfo.ids);
  console.log(`[VideoSync] 삭제된 DB IDs:`, deletedVideoInfo.dbIds);
  
  window.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: deletedVideoInfo
  }));
}

/**
 * 비디오 삭제 동기화 Composable
 */
export function useVideoSync(items, selectedIds, chatSessions, options = {}) {
  const {
    onVideoDeleted = null,
    updateVideoList = null,
    updateChatSessions = null
  } = options;
  
  // 삭제된 비디오 ID를 Set으로 변환 (타입 통일)
  const normalizeDeletedIds = (idsArray) => {
    const deletedIds = new Set();
    
    idsArray.forEach(id => {
      if (id != null && id !== undefined) {
        deletedIds.add(id);
        deletedIds.add(String(id));
        if (typeof id === 'string' && !isNaN(Number(id))) {
          deletedIds.add(Number(id));
        }
        if (typeof id === 'number') {
          deletedIds.add(String(id));
        }
      }
    });
    
    return deletedIds;
  };
  
  // 비디오 삭제 처리 핸들러
  const handleVideosDeleted = (event) => {
    console.log('[VideoSync] 삭제 이벤트 수신됨', event);
    const { ids, dbIds } = event.detail || {};
    
    const idsArray = Array.isArray(ids) ? ids : [];
    const dbIdsArray = Array.isArray(dbIds) ? dbIds : [];
    
    if (idsArray.length === 0 && dbIdsArray.length === 0) {
      console.log('[VideoSync] 삭제할 동영상이 없음');
      return;
    }
    
    const deletedIds = normalizeDeletedIds(idsArray);
    const deletedDbIds = normalizeDeletedIds(dbIdsArray);
    
    console.log(`[VideoSync] 삭제 처리 시작: ids=${idsArray.length}개, dbIds=${dbIdsArray.length}개`);
    
    // items에서 삭제된 비디오 제거
    if (items && Array.isArray(items.value)) {
      const beforeCount = items.value.length;
      const newItems = items.value.filter(video => {
        const videoId = video.id;
        const videoDbId = video.dbId;
        
        const shouldRemove = checkVideoDeleted(videoId, videoDbId, deletedIds, deletedDbIds);
        
        if (shouldRemove && video.objectUrl) {
          try {
            URL.revokeObjectURL(video.objectUrl);
          } catch (error) {
            console.error("Failed to revoke object URL:", error);
          }
        }
        
        return !shouldRemove;
      });
      
      // 배열 참조를 완전히 새로 생성
      if (newItems.length === 0) {
        items.value = [];
      } else {
        items.value = newItems.map(v => ({ ...v }));
      }
      
      const deletedCount = beforeCount - items.value.length;
      if (deletedCount > 0) {
        console.log(`[VideoSync] items에서 ${deletedCount}개 동영상 제거됨`);
      }
      
      // 커스텀 업데이트 함수 호출
      if (updateVideoList) {
        updateVideoList();
      }
    }
    
    // selectedIds에서 삭제된 비디오 제거
    if (selectedIds && Array.isArray(selectedIds.value)) {
      selectedIds.value = selectedIds.value.filter(id => {
        if (id == null) return true;
        const idStr = String(id);
        const idNum = !isNaN(Number(id)) ? Number(id) : null;
        return !deletedIds.has(id) && 
               !deletedIds.has(idStr) && 
               !deletedIds.has(idNum) &&
               !deletedDbIds.has(id) && 
               !deletedDbIds.has(idStr) && 
               !deletedDbIds.has(idNum);
      });
    }
    
    // 채팅 세션에서 삭제된 비디오 제거
    if (chatSessions && Array.isArray(chatSessions.value) && updateChatSessions) {
      updateChatSessions(deletedIds, deletedDbIds);
    }
    
    // 커스텀 콜백 호출
    if (onVideoDeleted) {
      onVideoDeleted(deletedIds, deletedDbIds);
    }
  };
  
  // 이벤트 리스너 등록
  onMounted(() => {
    window.addEventListener(EVENT_NAME, handleVideosDeleted);
    console.log('[VideoSync] 이벤트 리스너 등록 완료');
  });
  
  // 이벤트 리스너 제거
  onBeforeUnmount(() => {
    window.removeEventListener(EVENT_NAME, handleVideosDeleted);
  });
  
  return {
    handleVideosDeleted
  };
}
