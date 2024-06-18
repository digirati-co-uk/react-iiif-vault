import { useCanvasChoices } from '../../hooks/useCanvasChoices';
import { LocaleString } from '../../utility/i18n-utils';

export function ViewChoices() {
  const { choices, actions } = useCanvasChoices();
  if (choices.length === 0) {
    return null;
  }

  return (
    <div>
      <h2>Choices</h2>
      <ul>
        {choices.map(({ canvasId, choice }, index) => (
          <li key={index}>
            {canvasId}
            {choice.items.map((paintingChoice) => {
              return (
                <div>
                  <LocaleString>{paintingChoice.label}</LocaleString>
                  <ul>
                    {paintingChoice.items.map((item) => {
                      return (
                        <li className="p-2 flex gap-2">
                          <LocaleString>{item.label}</LocaleString>
                          <button
                            className={
                              item.selected
                                ? 'bg-green-500 hover:bg-green-700 text-white text-sm py-1 px-3 rounded-full'
                                : 'bg-gray-500 hover:bg-gray-700 text-white text-sm py-1 px-3 rounded-full'
                            }
                            onClick={() => {
                              actions.makeChoice(item.id, { deselectOthers: true });
                            }}
                          >
                            Choose
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
