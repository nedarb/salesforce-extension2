/* eslint-disable no-restricted-syntax */
export const LocalhostSuffix = '.lightning.localhost.sfdcdev.force.com';
export const SalesforceDomains = [
  '.lightning.force.com',
  '.lightning.pc-rnd.force.com',
  '.my.salesforce.com',
  '.my.localhost.sfdcdev.salesforce.com',
  '.my.pc-rnd.salesforce.com',
  '.my.pc-rnd.salesforce-setup.com',
  LocalhostSuffix,
];

interface Mapper {
  test: RegExp;
  convert: (matchResult: string, ...groups: string[]) => string;
}
const Mappers: Mapper[] = [
  {
    test: /([\w-]+)\.(\w+)\.test1\.lightning\.pc-rnd\.force\.com/i,
    convert: (_, mydomain, other) =>
      `https://${mydomain}.${other}.test1.my.pc-rnd.salesforce.com/`,
  },
  {
    test: /(\w+)\.lightning\.localhost\.sfdcdev\.force\.com/i,
    convert: (_: string, name: string) =>
      `${name}.lightning.localhost.sfdcdev.force.com`,
  },
  {
    test: /(\w+)\.my\.localhost\.sfdcdev\.salesforce\.com/i,
    convert: (matchResult: string) => `https://${matchResult}`,
  },
  {
    test: /([\w-]+)\.develop\.test1\.my\.pc-rnd\.salesforce\.com/i,
    convert: (matchResult: string) => `https://${matchResult}/`,
  },
  {
    test: /([\w-]+)\.(\w+)\.test1\.my\.pc-rnd\.salesforce-setup\.com/i,
    convert: (_, mydomain, other) =>
      `https://${mydomain}.${other}.test1.my.pc-rnd.salesforce.com/`,
  },
  {
    test: /([\w-]+)\.lightning\.force\.com/i,
    convert: (_, mydomain) => `https://${mydomain}.my.salesforce.com/`,
  },
];

export default function urlToSalesforceMyDomain(
  url?: string | null,
): string | undefined {
  if (url && url.indexOf('://') < 0) {
    return urlToSalesforceMyDomain(`https://${url}/`);
  }

  const urlObject = url?.startsWith('http') ? new URL(url) : null;

  if (
    url &&
    urlObject?.host &&
    SalesforceDomains.find((domain) => urlObject.host.endsWith(domain))
  ) {
    const { host } = urlObject;
    const parts = urlObject?.host.split('.');
    if (parts && parts.length > 0) {
      const tld = parts[parts.length - 2];
      if (tld === 'salesforce') {
        return url;
      }
      for (const mapper of Mappers) {
        const test = mapper.test.exec(host);
        if (test && test.length > 0) {
          const [result, ...rest] = test;
          return mapper.convert(result!, ...rest);
        }
      }

      return `https://${parts[0]}.my.salesforce.com/`;
    }
  }

  return undefined;
}
