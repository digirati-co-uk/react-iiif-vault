export declare function useCanvasClock(canvasId?: string, autoplay?: boolean): {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    play: () => void;
    pause: () => void;
    seek: import("react").Dispatch<import("react").SetStateAction<number>>;
};
