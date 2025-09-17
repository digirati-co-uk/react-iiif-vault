import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  type AnnotationRequest,
  type AnnotationRequestOptions,
  type AnnotationResponse,
  requestToAnnotationResponse,
} from '../canvas-panel/context/atlas-store';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

export function useRequestAnnotation(opts?: { onSuccess?: (r: AnnotationResponse) => void }) {
  const [id, setId] = useState(0);
  const store = useAtlasStore();
  const toolEnabled = useStore(store, (s) => s.tool.enabled);
  const toolRequestId = useStore(store, (s) => s.tool.requestId);
  const getRequestId = useStore(store, (s) => s.getRequestId);
  const requestAnnotation = useStore(store, (s) => s.requestAnnotation);
  const completeRequest = useStore(store, (s) => s.completeRequest);
  const cancelRequest = useStore(store, (s) => s.cancelRequest);

  const latestOnSuccess = useRef(opts?.onSuccess);
  latestOnSuccess.current = opts?.onSuccess;

  // Sequence.
  const [isPending, setIsPending] = useState(false);
  const [data, setData] = useState<AnnotationResponse | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const busy = toolEnabled && toolRequestId !== requestId;
  const isActive = toolEnabled && toolRequestId === requestId;

  const mutateAsync = useCallback(
    async (request: AnnotationRequest, options?: Omit<AnnotationRequestOptions, 'requestId'>) => {
      if (requestId) {
        const onSuccess = latestOnSuccess.current;
        setIsPending(true);
        const response = await requestAnnotation(request, {
          ...options,
          requestId: requestId,
        });
        if (response) {
          onSuccess?.(response);
          setId((i) => i + 1);
          setIsPending(false);
          setData(response);
          return response;
        }

        // Otherwise the request was cancelled
        const resp = {
          id: requestId,
          cancelled: true,
          ...requestToAnnotationResponse(request),
        };
        onSuccess?.(resp);
        setData(resp);
        setId((i) => i + 1);
        setIsPending(false);
        return resp;
      }
      return null;
    },
    [requestAnnotation, requestId],
  );

  const reset = useCallback(() => {
    setData(null);
    setIsPending(false);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const request = getRequestId();
    setRequestId(request.requestId);
    return () => {
      request.clear();
    };
  }, [id]);

  return {
    id,
    busy,
    isPending,
    isActive,
    requestId,
    requestAnnotation: mutateAsync,
    cancelRequest: () => (requestId ? cancelRequest(requestId) : void 0),
    completeRequest: () => (requestId ? completeRequest(requestId) : void 0),
    reset,
    data,
  };
}
