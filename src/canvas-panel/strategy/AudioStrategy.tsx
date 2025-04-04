import { useRenderControls } from "../../context/ControlsContext";
import { useStrategy } from "../../context/StrategyContext";
import { Audio, type AudioComponentProps } from "../render/Audio";
import { ThumbnailFallbackImage } from "../render/ThumbnailFallbackImage";

interface RenderAudioStrategyProps {
	as?: React.ComponentType<AudioComponentProps>;
}

export function RenderAudioStrategy({
	as: CustomAudio,
}: RenderAudioStrategyProps) {
	const { strategy } = useStrategy();
	const { renderMediaControls, mediaControlsDeps } = useRenderControls();

	if (strategy.type !== "media" || strategy.media.type !== "Sound") return null;

	return (
		<>
			<Audio
				key={strategy.media.url}
				media={strategy.media}
				mediaControlsDeps={mediaControlsDeps}
				audioCopmonent={CustomAudio}
			>
				<ThumbnailFallbackImage />
				{renderMediaControls ? renderMediaControls(strategy) : null}
			</Audio>
		</>
	);
}
