export interface FieldLookupResult {
    'count': number;
    'currentPageToken': string | null;
    'currentPageUrl': string; // "/services/data/v55.0/ui-api/lookups/ADM_Work__c/Assignee__c/User?searchType=Recent&page=1&pageSize=25",
    'nextPageToken': string | null;
    'nextPageUrl': string; // "/services/data/v55.0/ui-api/lookups/ADM_Work__c/Assignee__c/User?searchType=Recent&page=2&pageSize=25",
    'previousPageToken': string | null;
    'previousPageUrl': string | null,
    'records': Array<
        {
            'apiName': string; // 'User',
            // 'childRelationships': {},
            'eTag': string; // '53bfffac9ffadfae624a24c084f04176',
            'fields': {
                'DisambiguationField': {
                    'displayValue': null,
                    'value': string; // 'Software Engineering Architect'
                },
                'Id': {
                    'displayValue': null,
                    'value': string; // '005B00000018ETdIAM'
                },
                'Name': {
                    'displayValue': null,
                    'value': string; // '005B00000018ETdIAM'
                },
                [key: string] : {
                    'displayValue': string | null,
                    'value': string; // 'Braden'
                },
            },
            'id': string; // '005B00000018ETdIAM',
            'lastModifiedById': strnig; // '005B0000000HDdbIAG',
            'lastModifiedDate': string; // '2022-06-07T02:02:32.000Z',
            'recordTypeId': string|null,
            'recordTypeInfo': string|null,
            'systemModstamp': string; // '2022-06-13T05:13:12.000Z',
            'weakEtag': number; // 1655097192000
        }>
}
