/* eslint-disable no-restricted-syntax */
import React, {
  useEffect, useMemo, useRef, useState,
  useCallback,
} from 'react';
import ReactDOM from 'react-dom';
import browser, { search } from 'webextension-polyfill';
import {
  Modal, Autocomplete, Loader, MultiSelect, SelectItem,
} from '@mantine/core';
import { NotificationsProvider, showNotification } from '@mantine/notifications';

import { makeQueryCall, useSalesforceApi } from '../../hooks/useSalesforceQuery';
import useDebounce from '../../hooks/useDebounce';
import useAsyncState, { useAsyncState2 } from '../../hooks/useAsyncState';
import useLocation from '../../hooks/useLocation';

interface SObjectDescribeResult {
  fields:Array<{name: string;
    label: string;
    type: string;
    updateable: boolean,
    picklistValues?: Array<{active: boolean; label: string; value: string}>
    relationshipName?: string;
    referenceTo?: Array<string>;
  }>;
  childRelationships: Array<{
    'cascadeDelete' : boolean;
    'childSObject' : string;// "ADM_Acceptance_Criterion__c",
    'deprecatedAndHidden' : boolean,
    'field' : string, // "Work__c",
    'relationshipName' : string; // "Acceptance_Criteria__r",
    'restrictedDelete' : boolean
  }>;
}

function extractSObjectName(url: URL): { sobjectName?: string; recordId?: string; } {
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'lightning') {
    if (pathParts[1] === 'r') {
      return { sobjectName: pathParts[2], recordId: pathParts[3] };
    }
  }

  return {};
}

const UpdateAction: SelectItem = { value: 'update', label: 'Update' };
const RelationshipsAction: SelectItem = { value: 'relationships', label: 'Relationships' };

const Actions:Array<SelectItem> = [UpdateAction,
  { value: 'delete', label: 'Delete' },
  RelationshipsAction];

class ActionCache {
    private readonly cache: Record<string, SelectItem> = {};

    public getFromValue(value: string): SelectItem | undefined {
      if (value in this.cache) {
        return this.cache[value];
      }

      return undefined;
    }

    public get(value: string, label: string): SelectItem {
      if (!this.cache[value]) {
        this.cache[value] = { value, label };
      }
      return this.cache[value]!;
    }
}

const actionCache = new ActionCache();

async function getOptions(
  selection: Array<string>,
  currentQuery: string,
  describeResult?: SObjectDescribeResult,
  cookie: browser.Cookies.Cookie,
): Promise<Array<SelectItem>> {
  if (selection.length > 0) {
    const [selectedAction, selectedSubAction, selectedSubActionValue] = selection;
    switch (selectedAction) {
      case UpdateAction.value:
        if (!describeResult) {
          return [UpdateAction];
        }

        if (selectedSubAction) {
          // selectedSubAction is the selected field
          const field = describeResult.fields.find((f) => f.name === selectedSubAction);
          if (field) {
            if (field.picklistValues?.length) {
              return [UpdateAction, { value: field.name, label: field.label }, ...field.picklistValues];
            }

            const referenceTo = field.referenceTo?.length === 1 ? field.referenceTo[0] : null;
            if (referenceTo) {
              // query reference to
              console.log('Going to search referenceTo', field.referenceTo);
              const query = currentQuery.length > 0 ? `select Id, Name from ${referenceTo} where name like '%${currentQuery}%' limit 10` :
                `SELECT Id, Name FROM RecentlyViewed WHERE Type='${referenceTo}' ORDER BY LastViewedDate DESC`;
              const results = await makeQueryCall<{ Id: string; Name: string;}>({ query, cookie, useCache: true });
              console.log('results', results);
              return [UpdateAction, { value: field.name, label: field.label },
                ...results.records.map((r) => actionCache.get(r.Id, r.Name))];
            }

            return [UpdateAction, { value: field.name, label: field.label }];
          }
          return [UpdateAction, { value: selectedSubAction, label: selectedSubAction }];
        }
        return [UpdateAction,
          ...(describeResult.fields.filter((f) => f.updateable).map((field) => ({ value: field.name, label: field.label }))),
        ];
      case RelationshipsAction.value:
        if (!describeResult) {
          return [UpdateAction];
        }

        if (selectedSubAction) {
          // already selected a subaction
          return [RelationshipsAction,
            ...(describeResult.childRelationships.filter((r) => r.relationshipName === selectedSubAction).map((r) => ({ value: r.relationshipName, label: r.relationshipName })))];
        }
        return [RelationshipsAction,
          ...(describeResult.childRelationships.filter((r) => r.relationshipName).map((r) => ({ value: r.relationshipName, label: r.relationshipName })))];
      default:
    }
  }

  return Actions;
}

interface ActionExecutor {
  canExecute: (selection: Array<string>)=>boolean;
  execute: (recordId: string, selection: Array<string>) => Promise<string>;
}

const actionExecutors: Array<ActionExecutor> = [{
  canExecute: (selection: Array<string>) => selection[0] === 'update' && selection.length === 3,
  execute: (recordId, [, fieldName, updatedValue]) => {
    showNotification({ title: 'Updated', message: `Updating ${fieldName} to ${updatedValue}` });
    return Promise.resolve(`foobar ${recordId} ${fieldName}=${updatedValue}`);
  },
}];

function ToDisplay({ cookie, onClose }: {cookie: browser.Cookies.Cookie; onClose: ()=>void}) {
  const windowLocation = useLocation();
  const url = new URL(windowLocation.href);
  const { sobjectName, recordId } = extractSObjectName(url);
  const [value2, setMultiSelect] = useState<Array<string>>([]);
  const apiUrl = sobjectName ? `/services/data/v50.0/sobjects/${sobjectName}/describe` : undefined;
  const { results, isLoading } = useSalesforceApi<SObjectDescribeResult>({ url: apiUrl, cookie, useCache: false });
  const [query, setQuery] = useState('');
  const [debouncedQuery, immediatelySetDebouncedQuery] = useDebounce(query, 500);

  const [options, optionsLoading] = useAsyncState2(getOptions, value2, debouncedQuery, results, cookie);

  // const options: Array<SelectItem> = useMemo(() => getOptions(value2, debouncedQuery, results), [value2, results, debouncedQuery]);
  const handleChange = useCallback((updatedValue: Array<string>) => {
    setMultiSelect(updatedValue);
    if (recordId) {
      for (const executor of actionExecutors) {
        if (executor.canExecute(updatedValue)) {
          console.debug('Executing', executor, updatedValue);
          executor.execute(recordId, updatedValue).then(console.info);
          return;
        }
      }
    }
    immediatelySetDebouncedQuery('');
  }, [recordId]);

  return (
    <Modal title="Salesforce actions" onClose={onClose} opened overflow="inside">
      HELLO WORLD
      <MultiSelect
        searchable
        data-autofocus
        value={value2}
        onChange={handleChange}
        onSearchChange={setQuery}
        data={options || []}
        label="Your favorite frameworks/libraries"
        placeholder="Pick all that you like"
        rightSection={isLoading || optionsLoading ? <Loader size={16} /> : null}
      />
      {JSON.stringify(results)}
    </Modal>
  );
}

function App() {
  const [isShowing, setIsShowing] = useState(false);
  const handleOverlayClick = () => setIsShowing((cur) => !cur);
  const [cookie, setCookie] = useState<browser.Cookies.Cookie>();
  useSalesforceApi({ url: '/services/data/v50.0/services/' });

  useEffect(() => {
    const listener = (msg: any) => {
      console.log('GOT MESSAGE', msg);
      if (msg?.command === 'toggle-popover') {
        setIsShowing((cur) => !cur);
        setCookie(msg.cookie);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  if (!isShowing || !cookie) { return null; }

  return <ToDisplay cookie={cookie} onClose={handleOverlayClick} />;
}

const el = document.createElement('div');
el.id = 'sf-extension';
document.body.appendChild(el);

ReactDOM.render(
  <React.StrictMode>
    <NotificationsProvider>
      <App />
    </NotificationsProvider>
  </React.StrictMode>,
  el,
);

console.log('FOOBAR!');

export {}; // stops ts error that the file isn't a module
