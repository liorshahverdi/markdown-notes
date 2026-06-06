import { describe, expect, it } from 'vitest';
import { getHomeShellPolicy } from './homeShell';

describe('getHomeShellPolicy', () => {
  it('keeps the markdown vault/folder browser visible on desktop even when no note is open', () => {
    expect(
      getHomeShellPolicy({
        isMobile: false,
        hasSelectedNote: false,
        legacyBrowserOpen: false,
        mobileSidebarOpen: false,
      })
    ).toEqual({
      showDesktopSidebar: true,
      showDesktopResizeHandle: true,
      showMobileSidebar: false,
      showLegacyOpenAction: false,
    });
  });

  it('keeps the markdown editor shell visible after a note is explicitly open', () => {
    expect(
      getHomeShellPolicy({
        isMobile: false,
        hasSelectedNote: true,
        legacyBrowserOpen: false,
        mobileSidebarOpen: false,
      }).showDesktopSidebar
    ).toBe(true);
  });

  it('does not require a legacy-browse action to access folders on desktop', () => {
    const policy = getHomeShellPolicy({
      isMobile: false,
      hasSelectedNote: false,
      legacyBrowserOpen: true,
      mobileSidebarOpen: false,
    });

    expect(policy.showDesktopSidebar).toBe(true);
    expect(policy.showLegacyOpenAction).toBe(false);
  });

  it('keeps the mobile folder drawer controlled by the mobile toggle', () => {
    expect(
      getHomeShellPolicy({
        isMobile: true,
        hasSelectedNote: false,
        legacyBrowserOpen: false,
        mobileSidebarOpen: true,
      }).showMobileSidebar
    ).toBe(true);

    expect(
      getHomeShellPolicy({
        isMobile: true,
        hasSelectedNote: false,
        legacyBrowserOpen: true,
        mobileSidebarOpen: false,
      }).showMobileSidebar
    ).toBe(false);
  });
});
