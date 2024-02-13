import { InternationalString } from '@iiif/presentation-3';
import { useMemo } from 'react';
import { LocaleString } from '../utility/i18n-utils';

type FacetConfig = {
  id: string;
  label: InternationalString;
  keys: string[];
  values?: FacetConfigValue[];
};

type FacetConfigValue = {
  id: string;
  label: InternationalString;
  values: string[];
  key: string;
};

export interface MetadataProps {
  config?: FacetConfig[];
  metadata?: Array<{ label: InternationalString; value: InternationalString } | null>;
  labelWidth?: number;
  allowHtml?: boolean;
  showEmptyMessage?: boolean;
  separator?: string;

  classes?: {
    container?: string;
    row?: string;
    label?: string;
    value?: string;
    empty?: string;
  };

  emptyMessage?: string;
  emptyValueFallback?: string;
  emptyLabelFallback?: string;

  // Slots.
  tableHeader?: React.ReactNode;
  tableFooter?: React.ReactNode;
  emptyFallback?: React.ReactNode;
}

export function Metadata({
  metadata = [],
  config,
  labelWidth = 16,
  showEmptyMessage = true,
  allowHtml,
  emptyFallback,
  classes = {},
  emptyMessage = 'No metadata available',
  emptyValueFallback = 'No value',
  emptyLabelFallback = '',
  separator,
  tableFooter,
  tableHeader,
}: MetadataProps) {
  const metadataKeyMap = useMemo(() => {
    const flatKeys = (config || []).reduce((state, i) => {
      return [...state, ...i.keys];
    }, [] as string[]);

    const map: { [key: string]: Array<{ label: InternationalString; value: InternationalString }> } = {};
    for (const item of metadata) {
      const labels = item && item.label ? Object.values(item.label) : [];
      for (const label of labels) {
        if (
          label &&
          label.length &&
          (flatKeys.indexOf(`metadata.${label[0]}`) !== -1 || flatKeys.length === 0) &&
          item
        ) {
          const key = `metadata.${label[0]}`;
          map[key] = map[key] ? map[key] : [];
          map[key].push(item);
          break;
        }
      }
    }
    return map;
  }, [config, metadata]);

  const isEmpty = Object.keys(metadataKeyMap).length === 0;

  if (isEmpty && showEmptyMessage) {
    return <>{emptyFallback}</> || <div className={classes.empty}>{emptyMessage}</div>;
  }

  if (config && config.length) {
    return (
      <table className={classes.container}>
        {tableHeader}
        <tbody>
          {config.map((configItem, idx: number) => {
            const values: any[] = [];

            for (const key of configItem.keys) {
              for (const item of metadataKeyMap[key] || []) {
                values.push(
                  <LocaleString
                    key={idx + '__' + key}
                    enableDangerouslySetInnerHTML={allowHtml}
                    defaultText={emptyValueFallback}
                    separator={separator}
                  >
                    {item.value}
                  </LocaleString>
                );
              }
            }

            if (values.length === 0) {
              return null;
            }

            return (
              <tr className={classes.row} key={idx}>
                <td className={classes.label} style={labelWidth ? { minWidth: labelWidth } : {}}>
                  <LocaleString
                    enableDangerouslySetInnerHTML={allowHtml}
                    separator={separator}
                    defaultText={emptyLabelFallback}
                  >
                    {configItem.label}
                  </LocaleString>
                </td>
                <td className={classes.value}>{values}</td>
              </tr>
            );
          })}
        </tbody>
        {tableFooter}
      </table>
    );
  }

  return (
    <table className={classes.container}>
      {tableHeader}
      <tbody>
        {metadata && metadata.length
          ? metadata.map((metadataItem, idx: number) => {
              if (!metadataItem) {
                return null; // null items.
              }
              return (
                <tr className={classes.row} key={idx}>
                  <td className={classes.label} style={labelWidth ? { minWidth: labelWidth } : {}}>
                    <LocaleString
                      enableDangerouslySetInnerHTML={allowHtml}
                      defaultText={emptyValueFallback}
                      separator={separator}
                    >
                      {metadataItem.label}
                    </LocaleString>
                  </td>
                  <td className={classes.value}>
                    <LocaleString
                      enableDangerouslySetInnerHTML={allowHtml}
                      defaultText={emptyValueFallback}
                      separator={separator}
                    >
                      {metadataItem.value}
                    </LocaleString>
                  </td>
                </tr>
              );
            })
          : null}
      </tbody>
      {tableFooter}
    </table>
  );
}
