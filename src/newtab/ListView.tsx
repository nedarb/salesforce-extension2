import React, { useMemo } from 'react';
import browser from 'webextension-polyfill';
import { useSalesforceApi } from '../hooks/useSalesforceQuery';
import QueryResultsTable from '../components/QueryResultsTable';

export type ListViewDetails = {
  id: string;
  label: string;
  resultsUrl: string;
  url: string;
  describeUrl: string;
  developerName: string;
};

interface Props {
  cookie: browser.Cookies.Cookie;
  listView: ListViewDetails;
}

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function ListView({ cookie, listView }: Props) {
  const { results } = useSalesforceApi<{
    id: string;
    done: boolean;
    label: string;
    developerName: string;
    size: number;
    columns: {
      ascendingLabel: string;
      descendingLabel: string;
      label: string;
      fieldNameOrPath: string;
      type: string;
      hidden: boolean;
      sortable: boolean;
    }[];
    records: { columns: { fieldNameOrPath: string; value: string }[] }[];
  }>({
    url: listView.resultsUrl,
    cookie,
  });

  const transformedResults = useMemo(() => {
    if (results) {
      const columns = new Map(
        results.columns.map((col) => [col.fieldNameOrPath, col]),
      );
      return {
        done: results.done,
        records: results.records.map((r) => Object.fromEntries(
          r.columns
            // .filter(
            //   (field) => columns.get(field.fieldNameOrPath)?.hidden === false,
            // )
            .map((e) => {
              const { fieldNameOrPath, value } = e;
              const column = columns.get(fieldNameOrPath);
              if (column?.type === 'date') {
                const [, month, day, year] =
                    /\w{3} (\w{3}) (\d{2}).+(\d{4})/i.exec(value) ?? [];
                if (month && day && year) {
                  return [fieldNameOrPath, `${month} ${day}, ${year}`];
                }
              } else if (column?.type === 'currency') {
                return [fieldNameOrPath, formatter.format(parseFloat(value))];
              }
              return [fieldNameOrPath, value];
            }),
        )),
        columns,
      };
    }
    return undefined;
  }, [results]);

  return (
    <div>
      <a href={`https://${cookie.domain}`} target="_blank" rel="noreferrer">
        {listView.label}
      </a>
      {!transformedResults ? (
        <div>loading...</div>
      ) : (
        <QueryResultsTable
          cookie={cookie}
          queryResults={transformedResults}
          columns={transformedResults.columns}
        />
      )}
    </div>
  );
}

export default React.memo(ListView);
