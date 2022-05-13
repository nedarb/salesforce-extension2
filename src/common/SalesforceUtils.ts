export const SalesforceDomains = ['.lightning.force.com', '.my.salesforce.com'];

export default function urlToSalesforceMyDomain(
  url?: string | null,
): string | undefined {
  if (url && url.indexOf('://') < 0) {
    return urlToSalesforceMyDomain(`https://${url}`);
  }

  const urlObject = url?.startsWith('http') ? new URL(url) : null;

  if (SalesforceDomains.find((domain) => urlObject?.host.endsWith(domain))) {
    const parts = urlObject?.host.split('.');
    if (parts && parts.length > 0) {
      return `https://${parts[0]}.my.salesforce.com/`;
    }
  }

  return undefined;
}
