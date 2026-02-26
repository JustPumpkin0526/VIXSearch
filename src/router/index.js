/***************************************************
 * src/router/index.js
 **************************************************/
import { createRouter, createWebHistory } from "vue-router";

import Summarize from "@/components/Summarize.vue";
import management from "@/components/management.vue";
import search from "@/components/Search.vue";
import Report from "@/components/Report.vue";
import Setting from "@/components/Setting.vue";
import Help from "@/components/Help.vue";
import Login from "@/components/Login.vue";
import Register from "@/components/Register.vue";
import ResetPassword from "@/components/ResetPassword.vue";
// import EventReviewer from "@/components/EventReviewer.vue";
// import CVEventDetector from "@/components/CVEventDetector.vue";
import AdminApproval from "@/components/AdminApproval.vue";

const routes = [
  { path: "/", redirect: "/login" },
  { path: "/summarize", name: "Summarize", component: Summarize },
  { path: "/search", name: "search", component: search },
  { path: "/management", name: "management", component: management },
  { path: "/report", name: "Report", component: Report },
  // { path: "/event-reviewer", name: "EventReviewer", component: EventReviewer },
  // { path: "/cv-event-detector", name: "CVEventDetector", component: CVEventDetector },
  { path: "/admin-approvals", name: "AdminApproval", component: AdminApproval },
  { path: "/setting", name: "Setting", component: Setting },
  { path: "/help", name: "Help", component: Help },
  { path: "/login", name: "Login", component: Login },
  { path: "/register", name: "Register", component: Register },
  { path: "/reset-password", name: "ResetPassword", component: ResetPassword }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 네비게이션 가드: 로그인된 사용자는 자동으로 /storage로 리다이렉트
router.beforeEach((to, from, next) => {
  const userId = localStorage.getItem("vss_user_id");
  const userRole = localStorage.getItem("vss_user_role");
  
  // 로그인 페이지로 가려고 할 때 이미 로그인되어 있으면 /storage로 리다이렉트
  if (to.path === "/login" && userId) {
    next("/management");
  }
  // 회원가입 및 비밀번호 재설정 페이지는 로그인 여부와 관계없이 접근 가능
  else if (to.path === "/register" || to.path === "/reset-password") {
    next();
  }
  // 보호된 페이지(로그인이 필요한 페이지)에 접근할 때
  else if (to.path !== "/login" && to.path !== "/register" && to.path !== "/reset-password" && !userId) {
    next("/login");
  }
  // 관리자 전용 페이지 접근 제한
  else if (to.path === "/admin-approvals" && userRole !== "ADMIN") {
    next("/management");
  }
  else {
    next();
  }
});

export default router;
