import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../state/projectStore";
import { readAutosave, writeAutosave } from "./index";
import { toast } from "../state/toastStore";

const AUTOSAVE_INTERVAL_MS = 60_000;

/** Writes the current project to app-data `autosave.2dm` every 60 s.
 *  Only writes when the project has actually changed since the last tick. */
export function AutosaveLoop() {
  const lastRef = useRef<unknown>(null);

  useEffect(() => {
    const tick = () => {
      const { project } = useProjectStore.getState();
      if (lastRef.current === project) return;
      lastRef.current = project;
      void writeAutosave(project).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("Autosave failed:", err);
      });
    };
    const id = window.setInterval(tick, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}

/** On first mount, if an autosave exists that's newer than the in-memory
 *  project, offer to restore it. Renders as a sticky banner at the top of
 *  the app until the user decides. */
export function RestorePrompt() {
  const [candidate, setCandidate] = useState<null | "checking" | "dismissed">("checking");
  const [projectJson, setProjectJson] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const autosaved = await readAutosave();
      if (cancelled) return;
      if (!autosaved) {
        setCandidate("dismissed");
        return;
      }
      // Compare against the fresh in-memory project. If the autosave just
      // matches the default blank project, skip the prompt.
      const serialisedAutosave = JSON.stringify(autosaved);
      const current = JSON.stringify(useProjectStore.getState().project);
      if (serialisedAutosave === current) {
        setCandidate("dismissed");
        return;
      }
      setProjectJson(serialisedAutosave);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (candidate === "dismissed" || projectJson === null) return null;

  return (
    <div className="restore-banner">
      <span>
        An autosave from a previous session was found.{" "}
        <strong>Restore it?</strong>
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="inspector-btn primary"
          onClick={() => {
            try {
              const project = JSON.parse(projectJson);
              useProjectStore.getState().replaceProject(project, null);
              toast.success("Restored from autosave");
            } catch (e) {
              toast.error(`Restore failed: ${e}`);
            }
            setCandidate("dismissed");
            setProjectJson(null);
          }}
        >
          Restore
        </button>
        <button
          className="inspector-btn"
          onClick={() => {
            setCandidate("dismissed");
            setProjectJson(null);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
