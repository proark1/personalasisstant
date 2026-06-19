import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface OpenEntityDetail {
  type: string;
  id: string;
  source?: string;
}

interface DeepLinkOptions {
  // Switch the in-shell panel for entity types that don't have a dedicated
  // route. Provided by StandardMode so we can flip between tasks / events /
  // notes / projects without leaving the SPA shell.
  setActivePanel?: (panel: string) => void;
  setSelectedProjectId?: (id: string | undefined) => void;
}

// Listens for `dori:open-entity` window events (push-notification taps,
// AI replies that surface an entity, etc.) and routes the user to the
// right view. Pure side-effect hook; safe to mount anywhere inside the
// react-router tree exactly once.
export function useDeepLinkHandler(opts: DeepLinkOptions = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenEntityDetail>).detail;
      if (!detail?.type || !detail?.id) return;

      // Bring the app to the foreground state where the entity makes sense.
      // For panels we already own (tasks / events / notes / projects) we
      // flip the in-shell panel and dispatch a follow-up event so the
      // panel can auto-select the row. For dedicated routes (contracts /
      // contacts / workspaces) we react-router-navigate.
      switch (detail.type) {
        case "task":
          opts.setActivePanel?.("tasks");
          // Most task lists key on a query-string param; emit a select
          // event for any panel that wants to scroll-to / open-modal.
          window.dispatchEvent(new CustomEvent("dori:select-task", { detail: { id: detail.id } }));
          break;
        case "event":
          opts.setActivePanel?.("calendar");
          window.dispatchEvent(new CustomEvent("dori:select-event", { detail: { id: detail.id } }));
          break;
        case "note":
          opts.setActivePanel?.("notes");
          window.dispatchEvent(new CustomEvent("dori:select-note", { detail: { id: detail.id } }));
          break;
        case "project":
          opts.setActivePanel?.("projects");
          opts.setSelectedProjectId?.(detail.id);
          break;
        case "contact":
          navigate("/contacts");
          break;
        case "contract":
          navigate("/contracts");
          break;
        case "workspace":
          navigate("/workspaces");
          break;
        case "activity":
          navigate("/activity");
          break;
        default:
          // Unknown type: log and bail. The notification still got
          // surfaced, the user just lands on the dashboard.
          console.warn("dori:open-entity unhandled type", detail.type);
      }
    };
    window.addEventListener("dori:open-entity", handler as EventListener);
    return () => window.removeEventListener("dori:open-entity", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, opts.setActivePanel, opts.setSelectedProjectId]); // opts object itself excluded — only the stable function refs matter
}
