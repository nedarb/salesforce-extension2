import React, {
  ComponentProps, useCallback, useMemo, useState,
} from 'react';
import {
  Tabs, Button, Select, Grid,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import browser from 'webextension-polyfill';
import {
  makeApiCall,
  useLatestApiVersion,
  useSalesforceApi,
} from '../hooks/useSalesforceQuery';
import useMemoAsync from '../hooks/useMemoAsync';
import ListView, { ListViewDetails } from './ListView';

type SObject = { name: string; label: string; queryable: boolean };

interface Props {
  cookie: browser.Cookies.Cookie;
}

type t = Pick<ComponentProps<typeof Select>, 'onChange'>;

function getListViews(
  cookie: browser.Cookies.Cookie,
  urls: string[],
): Promise<ListViewDetails[]> {
  console.log('getting list views', urls);
  const promises = urls.map(
    (url) => makeApiCall<ListViewDetails>({ url, cookie }).promise,
  );

  return Promise.all(promises);
}

export function ListViews({ cookie }: Props) {
  const [activeTab, setActiveTab] = useLocalStorage<string | null>({
    key: `listViewsTab:${cookie.domain}`,
    defaultValue: 'addNew',
  });

  const [savedListViews, updateSavedListViews] = useLocalStorage<string[]>({
    key: `savedListViews:${cookie.domain}`,
    defaultValue: [],
  });

  const [whichSObject, setWhichSObject] = useState<SObject>();
  const [whichListView, setWhichListView] = useState<ListViewDetails>();

  const latestApiVersion = useLatestApiVersion({ cookie });

  const {
    results: globalResults,
    isLoading: queryableObjectsLoading,
    error,
  } = useSalesforceApi<{
    sobjects: SObject[];
  }>({
    url: `/services/data/v${latestApiVersion}/sobjects`,
    cookie,
    useCache: true,
  });

  const {
    results: listViewsDescribe,
    isLoading: listViewsDescribeLoading,
    error: listViewsDescribeError,
  } = useSalesforceApi<{
    listviews: ListViewDetails[];
  }>({
    url: whichSObject
      ? `/services/data/v${latestApiVersion}/sobjects/${whichSObject.name}/listviews`
      : undefined,
    cookie,
    useCache: true,
  });

  const data = useMemo(
    () => (globalResults?.sobjects ?? []).map((o) => ({
      value: o.name,
      label: o.label,
    })),
    [globalResults],
  );
  const listViewData = useMemo(() => {
    return (listViewsDescribe?.listviews ?? []).map((l) => ({
      value: l.id,
      label: l.label,
    }));
  }, [listViewsDescribe]);

  const sobjectChanged = useCallback<(value: string | null) => void>(
    (value) => {
      const entry = globalResults?.sobjects.find((o) => o.name === value);
      console.log('entry', value, entry);
      if (entry) {
        setWhichSObject(entry);
      }
    },
  [globalResults]);

  const onListViewChanged = useCallback<(value: string | null) => void>(
    (value) => {
      const listview = listViewsDescribe?.listviews.find((s) => s.id === value);
      if (listview) {
        setWhichListView(listview);
      }
    },
  [listViewsDescribe]);

  const handleAddListView = useCallback(() => {
    if (whichListView) {
      updateSavedListViews([...savedListViews, whichListView.url]);
    }
  }, [whichSObject, whichListView, savedListViews]);

  const { value: fullSavedListViews } = useMemoAsync(getListViews, [
    cookie,
    savedListViews,
  ]);

  return (
    <Tabs className="tabs" value={activeTab} onTabChange={setActiveTab} keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="addNew">Add new</Tabs.Tab>
        {fullSavedListViews?.map((l) => (
          <Tabs.Tab key={l.id} value={l.id}>
            {l.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panel value="addNew">
        <div>
          <Grid>
            <Grid.Col span={3}>
              <Select
                searchable
                label="Objects"
                nothingFound="No results found."
                limit={100}
                disabled={queryableObjectsLoading}
                value={whichSObject?.name}
                onChange={sobjectChanged}
                data={data}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Select
                searchable
                label="Object list view"
                nothingFound="No results found."
                limit={100}
                disabled={queryableObjectsLoading}
                value={whichListView?.id}
                data={listViewData}
                onChange={onListViewChanged}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              {whichSObject?.name}
              {whichListView?.label}
              <Button
                disabled={!whichSObject || !whichListView}
                onClick={handleAddListView}
              >
                Add
              </Button>
            </Grid.Col>
          </Grid>
        </div>
      </Tabs.Panel>
      {fullSavedListViews?.map((l) => (
        <Tabs.Panel key={l.id} value={l.id}>
          <ListView cookie={cookie} listView={l} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

export default React.memo(ListViews);
