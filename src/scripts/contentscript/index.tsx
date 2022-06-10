import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import ReactDOM from 'react-dom';
import browser from 'webextension-polyfill';
import {
  Modal, Autocomplete, Loader, MultiSelect, SelectItem,
} from '@mantine/core';
import { useSalesforceApi } from '../../hooks/useSalesforceQuery';

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

function extractSObjectName(url: URL) {
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'lightning') {
    if (pathParts[1] === 'r') {
      return pathParts[2];
    }
  }

  return undefined;
}

const UpdateAction: SelectItem = { value: 'update', label: 'Update' };
const RelationshipsAction: SelectItem = { value: 'relationships', label: 'Relationships' };

const Actions:Array<SelectItem> = [UpdateAction,
  { value: 'delete', label: 'Delete' },
  RelationshipsAction];

function getOptions(selection: Array<string>, describeResult?: SObjectDescribeResult): Array<SelectItem> {
  if (selection.length > 0) {
    const [selectedAction, selectedSubAction] = selection;
    switch (selectedAction) {
      case UpdateAction.value:
        if (!describeResult) {
          return [UpdateAction];
        }

        if (selectedSubAction) {
          // selectedSubAction is the selected field
          const field = describeResult.fields.find((f) => f.name === selectedSubAction);
          if (field) {
            if (field.picklistValues) {
              return [UpdateAction, { value: field.name, label: field.label }, ...field.picklistValues];
            }

            return [UpdateAction, { value: field.name, label: field.label }];
          }
          return [UpdateAction, { value: selectedSubAction, label: selectedSubAction }];
        }
        return [UpdateAction,
          ...(describeResult ? describeResult.fields.filter((f) => f.updateable).map((field) => ({ value: field.name, label: field.label })) || [] : []),
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

function ToDisplay({ cookie, onClose }: {cookie: browser.Cookies.Cookie; onClose: ()=>void}) {
  const url = new URL(window.location.href);
  const sobjectName = extractSObjectName(url);
  const [value2, setMultiSelect] = useState<Array<string>>([]);
  const apiUrl = sobjectName ? `/services/data/v50.0/sobjects/${sobjectName}/describe` : undefined;
  const { results, isLoading } = useSalesforceApi<SObjectDescribeResult>({ url: apiUrl, cookie, useCache: false });

  const options: Array<SelectItem> = useMemo(() => getOptions(value2, results), [value2, results]);

  return (
    <Modal title="Salesforce actions" onClose={onClose} opened overflow="inside">
      HELLO WORLD
      <MultiSelect
        searchable
        data-autofocus
        value={value2}
        onChange={setMultiSelect}
        data={options}
        label="Your favorite frameworks/libraries"
        placeholder="Pick all that you like"
        rightSection={isLoading ? <Loader size={16} /> : null}
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
    <App />
  </React.StrictMode>,
  el,
);

console.log('FOOBAR!');

export {}; // stops ts error that the file isn't a module
