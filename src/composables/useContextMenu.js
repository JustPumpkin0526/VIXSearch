/**
 * 컨텍스트 메뉴 관리 Composable
 */

import { ref } from 'vue';

const CONTEXT_MENU_SIZE = { width: 200, height: 200, margin: 10 };

/**
 * 컨텍스트 메뉴 위치 제한
 */
export function constrainContextMenuPosition(x, y) {
  const { width, height, margin } = CONTEXT_MENU_SIZE;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // 경계 확인 및 조정
  if (x + width > windowWidth) x = windowWidth - width - margin;
  if (y + height > windowHeight) y = windowHeight - height - margin;
  if (x < margin) x = margin;
  if (y < margin) y = margin;

  return { x, y };
}

/**
 * 컨텍스트 메뉴 Composable
 */
export function useContextMenu() {
  const contextMenu = ref({ visible: false, x: 0, y: 0, data: null });
  
  const openContextMenu = (data, event) => {
    const { x, y } = constrainContextMenuPosition(event.clientX, event.clientY);
    contextMenu.value = { visible: true, x, y, data };
  };
  
  const closeContextMenu = () => {
    contextMenu.value.visible = false;
    contextMenu.value.data = null;
  };
  
  return {
    contextMenu,
    openContextMenu,
    closeContextMenu
  };
}
