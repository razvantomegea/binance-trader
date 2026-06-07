import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useElementSize } from "./use-element-size";

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

  fire(target: Element, width: number, height: number): void {
    target.getBoundingClientRect = () =>
      ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    this.callback(
      [{ target } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

function ElementSizeProbe() {
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  return (
    <div>
      <div ref={ref} data-testid="target" />
      <span data-testid="width">{width}</span>
      <span data-testid="height">{height}</span>
    </div>
  );
}

describe("useElementSize", () => {
  afterEach(() => {
    cleanup();
    ResizeObserverMock.instances = [];
    vi.restoreAllMocks();
  });

  it("returns initial zero size before measurement", () => {
    vi.stubGlobal(
      "ResizeObserver",
      ResizeObserverMock as unknown as typeof ResizeObserver,
    );

    render(<ElementSizeProbe />);

    expect(screen.getByTestId("width")).toHaveTextContent("0");
    expect(screen.getByTestId("height")).toHaveTextContent("0");
  });

  it("does nothing when ref is not attached", () => {
    function UnattachedProbe() {
      useElementSize<HTMLDivElement>();
      return <div data-testid="no-ref" />;
    }

    vi.stubGlobal(
      "ResizeObserver",
      ResizeObserverMock as unknown as typeof ResizeObserver,
    );

    render(<UnattachedProbe />);
    expect(ResizeObserverMock.instances).toHaveLength(0);
  });

  it("updates size when ResizeObserver reports dimensions", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      ResizeObserverMock as unknown as typeof ResizeObserver,
    );

    render(<ElementSizeProbe />);

    const target = screen.getByTestId("target");
    ResizeObserverMock.instances.at(-1)?.fire(target, 640, 320);

    await waitFor(() => {
      expect(screen.getByTestId("width")).toHaveTextContent("640");
      expect(screen.getByTestId("height")).toHaveTextContent("320");
    });
  });
});
