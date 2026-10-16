(() => {
'use strict';
const url=new URL(location.href),name=url.pathname.split('/').pop(),subject=url.searchParams.get('subject');
const aliases={'cost-accounting-practice':['cost-accounting','legacy-cost-core'],'cost-accounting-pyq':['cost-accounting','legacy-cost-pyq'],'advanced-cost-accounting':['cost-accounting','legacy-cost-advanced'],'cost-management-audit':['auditing','legacy-cost-audit'],'auditing':['auditing','all'],'cost-accounting':['cost-accounting','all']};
let route=null;
if(name==='cost-accounting.html')route=['cost-accounting','deep-cost'];
else if(name==='auditing.html')route=['auditing','all'];
else if(name==='practice.html'&&aliases[subject])route=aliases[subject];
if(!route)return;
const target=new URL('./subject-practice.html',location.href);target.search=url.search;target.searchParams.set('subject',route[0]);if(!target.searchParams.has('source'))target.searchParams.set('source',route[1]);target.hash=url.hash;location.replace(target.href);
})();
