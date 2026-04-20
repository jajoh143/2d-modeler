import { PixiViewport } from "./viewport/PixiViewport";
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
          <PixiViewport />
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
