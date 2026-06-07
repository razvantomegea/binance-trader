import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_HEADER_HEIGHT_VAR } from "@/constants/dashboard-layout";

import { useDashboardHeaderHeight } from "./use-dashboard-header-height";

type ResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver,
) => void;

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(private callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this);
  }

  fire(target: HTMLElement): void {
    this.callback(
      [{ target } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

function HeaderProbe() {
  const headerRef = useDashboardHeaderHeight();

  return <header ref={headerRef}>Dashboard header</header>;
}

describe("useDashboardHeaderHeight", () => {
  afterEach(() => {
    cleanup();
    ResizeObserverMock.instances = [];
    document.documentElement.style.removeProperty(DASHBOARD_HEADER_HEIGHT_VAR);
    vi.restoreAllMocks();
  });

  it("does nothing when header ref is not attached", () => {
    function UnattachedProbe() {
      useDashboardHeaderHeight();
      return <div />;
    }

    vi.stubGlobal(
      "ResizeObserver",
      ResizeObserverMock as unknown as typeof ResizeObserver,
    );

    render(<UnattachedProbe />);
    expect(ResizeObserverMock.instances).toHaveLength(0);
  });

  it("sets dashboard header height CSS variable from header offset", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      ResizeObserverMock as unknown as typeof ResizeObserver,
    );

    const { container } = render(<HeaderProbe />);
    const header = container.querySelector("header")!;
    Object.defineProperty(header, "offsetHeight", {
      value: 120,
      configurable: true,
    });

    ResizeObserverMock.instances.at(-1)?.fire(header);

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue(
          DASHBOARD_HEADER_HEIGHT_VAR,
        ),
      ).toBe("120px");
    });
  });

  it("removes dashboard header height CSS variable on unmount", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      ResizeObserverMock as unknown as typeof ResizeObserver,
    );

    const { container, unmount } = render(<HeaderProbe />);
    const header = container.querySelector("header")!;
    Object.defineProperty(header, "offsetHeight", {
      value: 96,
      configurable: true,
    });

    ResizeObserverMock.instances.at(-1)?.fire(header);

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue(
          DASHBOARD_HEADER_HEIGHT_VAR,
        ),
      ).toBe("96px");
    });

    unmount();

    expect(
      document.documentElement.style.getPropertyValue(
        DASHBOARD_HEADER_HEIGHT_VAR,
      ),
    ).toBe("");
    expect(ResizeObserverMock.instances.at(-1)?.disconnect).toHaveBeenCalled();
  });
});
