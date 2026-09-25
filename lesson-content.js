// Runs in an isolated content-script world; reads only the active curriculum row.
(() => {
  function currentLesson() {
    const url=new URL(location.href),pageKey=url.origin+url.pathname;
    const expectedId=url.pathname.match(/\/lecture\/(\d+)/)?.[1] || '';
    const rows=[...document.querySelectorAll('li[aria-current="true"]')].map(li=>({
      title:li.querySelector('[data-purpose="item-title"]')?.textContent.replace(/\s+/g,' ').trim() || '',
      id:li.querySelector('[id^="item-completion-state-"]')?.id.match(/^item-completion-state-(\d+)$/)?.[1] || ''
    })).filter(row=>row.title);
    const exact=expectedId?rows.filter(row=>row.id===expectedId):[];
    const candidates=exact.length?exact:rows.filter(row=>!expectedId||!row.id||row.id===expectedId);
    const titles=[...new Set(candidates.map(row=>row.title))];
    if(titles.length===1)return {status:'ok',title:titles[0],lectureId:expectedId||candidates[0].id,pageKey};
    if(rows.length)return {status:'transition',pageKey};
    return {status:'missing',pageKey,lectureId:expectedId};
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message.type!=='GET_CURRENT_LESSON'||sender.id!==chrome.runtime.id)return;
    reply(currentLesson());
  });
})();
