import { PixiViewport } from "./viewport/PixiViewport";
import { Rulers, RULER_THICKNESS } from "./viewport/Rulers";
import { SkeletonTabs } from "./viewport/SkeletonTabs";
import { ZoomIndicator } from "./viewport/ZoomIndicator";
import { Outline } from "./panels/Outline";
import { Inspector } from "./panels/Inspector";
import { AssetBrowser } from "./panels/AssetBrowser";
import { Timeline } from "./timeline/Timeline";
import { Toolbar } from "./panels/Toolbar";
import { MenuBar } from "./panels/MenuBar";

export default function App() {
  return (
    <div className="app-root">
      <MenuBar />
      <Toolbar />
      <div className="app-body">
        <aside className="left-panel">
          <Outline />
          <AssetBrowser />
        </aside>
        <main className="viewport-area">
          <SkeletonTabs />
          <div className="viewport-canvas-wrap">
            <Rulers />
            <ZoomIndicator />
            <div
              style={{
                position: "absolute",
                top: RULER_THICKNESS,
                left: RULER_THICKNESS,
                right: 0,
                bottom: 0,
              }}
            >
              <PixiViewport />
            </div>
          </div>
        </main>
        <aside className="right-panel">
          <Inspector />
        </aside>
      </div>
      <footer className="timeline-area">
        <Timeline />
      </footer>
    </div>
  );
}
