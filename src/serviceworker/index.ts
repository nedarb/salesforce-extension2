import browser from 'webextension-polyfill';
import urlToSalesforceMyDomain from '../common/SalesforceUtils';

browser.commands.onCommand.addListener(async (command, tab) => {
  console.log(`Command: ${command}`, tab);
  if (tab?.url && tab?.id) {
    const url = new URL(tab.url);
    if (url.host.toLowerCase().endsWith('.lightning.force.com')) {
      const mydomainUrl = urlToSalesforceMyDomain(tab.url);
      if (mydomainUrl) {
        const cookie = await browser.cookies.get({
          url: mydomainUrl,
          name: 'sid',
        });
        browser.tabs.sendMessage(tab.id, { command, cookie });
        console.log('foobar!', url);
      }
    }
  }
});

export {}; // stops ts error that the file isn't a module
