import type { InputShape } from "polygon-editor";
import qs from "query-string";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CanvasPanel } from "../canvas-panel";
import { SearchHighlights } from "../canvas-panel/render/SearchHighlights";
import { RenderSvgEditorControls } from "../components/SvgEditorControls";
import { Authenticate } from "../components/future/Authenticate";
import { useAnnotationPageManager } from "../hooks/useAnnotationPageManager";
import { useCanvas } from "../hooks/useCanvas";
// import { render, version } from 'react-dom-16';
// import { render, version } from 'react-dom-17';
import { useManifest } from "../hooks/useManifest";
import { useVault } from "../hooks/useVault";
import { LocaleString } from "../utility/i18n-utils";
import type { SimpleViewerContext } from "../viewers/SimpleViewerContext.types";
import { MediaControls } from "./media-controls";
import { ViewerControls } from "./viewer-controls";
import "./demo.css";
import { PolygonSelector } from "../components/annotations/PolygonSelector";
import { ComplexTimelineControls } from "./complex-timeline-controls";

const runtimeOptions = { maxOverZoom: 5 };
const defaultPreset = ["default-preset", { runtimeOptions }] as any;

function CanvasAnnotations() {
  const canvas = useCanvas();
  const pm = useAnnotationPageManager(canvas?.id);
  const vault = useVault();

  if (!canvas || pm.enabledPageIds.length === 0) {
    return null;
  }

  return (
    <>
      {pm.enabledPageIds.map((id) => (
        <CanvasPanel.RenderAnnotationPage key={id} page={vault.get(id)} />
      ))}
    </>
  );
}

function Label() {
  const manifest = useManifest();

  if (!manifest) {
    return <div>Loading..</div>;
  }

  return (
    <LocaleString as="h2" className="text-2xl my-3">
      {manifest.label}
    </LocaleString>
  );
}

const demo = document.getElementById("root")!;

const components = {
  MediaControls,
  ViewerControls,
  ComplexTimelineControls,
};

const App = () => {
  const [queryString, setQueryString] = useState<{
    manifest?: string;
    range?: string;
    canvas?: string;
  }>(() => qs.parse(window.location.hash.slice(1)));
  const [enablePolygon, setEnablePolygon] = useState(false);
  const { manifest, range, canvas } = queryString;
  const ref = useRef<SimpleViewerContext>(null);
  const [pagingEnabled, setPagingEnabled] = useState(true);

  useEffect(() => {
    const hashChange = () => {
      setQueryString(qs.parse(window.location.hash.slice(1)));
    };
    window.addEventListener("hashchange", hashChange);

    return () => window.removeEventListener("hashchange", hashChange);
  });

  const [shape, setShape] = useState<InputShape>({
    id: "example",
    points: [],
    open: true,
  });

  return (
    <>
      <style>
        {`
            [data-textual-content="true"] {
              background: #fff;
              font-size: 1.2em;
              font-family: system-ui, sans-serif;
              padding: 1em;
              margin-top: 1em;
            }
            * { box-sizing: border-box; }
            .atlas-container { background: #000; }

            body { padding: 0.5em }
        `}
      </style>
      <CanvasPanel
        key={`${manifest}-${range}-${canvas}`}
        ref={ref}
        spacing={20}
        header={<Label />}
        reuseAtlas={true}
        mode={enablePolygon ? "sketch" : "explore"}
        pagingEnabled={pagingEnabled}
        // renderPreset={defaultPreset}
        runtimeOptions={runtimeOptions}
        manifest={
          manifest ||
          "https://gist.githubusercontent.com/stephenwf/57cc5024144c53d48cc3c07cc522eb94/raw/a87a5d9a8f949bfb11cebd4f011a204abe8a932b/manifest.json"
        }
        startCanvas={canvas}
        components={components}
        annotations={
          <>
            <CanvasAnnotations />
            <SearchHighlights />
            <PolygonSelector
              id="example"
              polygon={shape}
              updatePolygon={setShape}
              readOnly={!enablePolygon}
              annotationBucket="default"
              renderControls={(helper, state, showShapes) => (
                <div className="flex gap-2">
                  <RenderSvgEditorControls
                    classNames={{
                      button: "p-2 bg-blue-500 text-white hover:bg-blue-400",
                    }}
                    helper={helper}
                    state={state}
                    showShapes={showShapes}
                  />
                </div>
              )}
            />
          </>
        }
      >
        <Authenticate />

        <div className="flex gap-2 my-4">
          <button
            className="p-2 bg-blue-500 text-white hover:bg-blue-400"
            onClick={() => setPagingEnabled((prev) => !prev)}
          >
            toggle paging
          </button>
          <button
            className="p-2 bg-blue-500 text-white hover:bg-blue-400"
            onClick={() => ref.current?.previousCanvas()}
          >
            prev
          </button>
          <button
            className="p-2 bg-blue-500 text-white hover:bg-blue-400"
            onClick={() => ref.current?.nextCanvas()}
          >
            next
          </button>
        </div>
      </CanvasPanel>
    </>
  );
};

// React 18 testing
const root = createRoot(demo);
root.render(<App />);

// React 16/17 testing
// render(toRender, demo);
