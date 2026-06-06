export type HomeShellPolicyInput = {
  isMobile: boolean;
  hasSelectedNote: boolean;
  legacyBrowserOpen: boolean;
  mobileSidebarOpen: boolean;
};

export type HomeShellPolicy = {
  showDesktopSidebar: boolean;
  showDesktopResizeHandle: boolean;
  showMobileSidebar: boolean;
  showLegacyOpenAction: boolean;
};

export function getHomeShellPolicy(input: HomeShellPolicyInput): HomeShellPolicy {
  const showDesktopSidebar = !input.isMobile;

  return {
    showDesktopSidebar,
    showDesktopResizeHandle: showDesktopSidebar,
    showMobileSidebar: input.isMobile && input.mobileSidebarOpen,
    showLegacyOpenAction: false,
  };
}
