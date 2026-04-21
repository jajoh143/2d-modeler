import { useState } from "react";
import { PixiViewport } from "./viewport/PixiViewport";
import { Rulers, RULER_THICKNESS } from "./viewport/Rulers";
import { SkeletonTabs } from "./viewport/SkeletonTabs";
import { ZoomIndicator } from "./viewport/ZoomIndicator";
import { Outline } from "./panels/Outline";
import { Inspector } from "./panels/Inspector";
import { AssetBrowser } from "./panels/AssetBrowser";
import { SlotsPanel } from "./panels/SlotsPanel";
import { SkinManager } from "./panels/SkinManager";
import { IkConstraintsPanel } from "./panels/IkConstraintsPanel";
import { LibraryPanel } from "./panels/LibraryPanel";
import { Timeline } from "./timeline/Timeline";
import { PlaybackLoop } from "./timeline/PlaybackLoop";
import { Toolbar } from "./panels/Toolbar";
import { MenuBar } from "./panels/MenuBar";
import { ExportDialog } from "./dialogs/ExportDialog";
import { ShortcutsPanel } from "./dialogs/ShortcutsPanel";
import { Toasts } from "./panels/Toasts";
import { AutosaveLoop, RestorePrompt } from "./persistence/autosave";

export default function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  return (
    <div className="app-root">
      <MenuBar
        onExport={() => setExportOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <Toolbar />
      <div className="app-body">
        <aside className="left-panel">
          <LibraryPanel />
          <Outline />
          <SlotsPanel />
          <AssetBrowser />
        </aside>
        <main className="viewport-area">
          <SkeletonTabs />
          <SkinManager />
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
          <IkConstraintsPanel />
        </aside>
      </div>
      <footer className="timeline-area">
        <Timeline />
      </footer>
      <PlaybackLoop />
      <AutosaveLoop />
      <RestorePrompt />
      <Toasts />
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {shortcutsOpen && <ShortcutsPanel onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
