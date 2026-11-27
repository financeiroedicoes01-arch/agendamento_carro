/* Não armazena dados de viagens em cache. O aplicativo requer conexão. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{data={title:'Novo aviso',body:'Abra o aplicativo para consultar.'}}
 event.waitUntil(self.registration.showNotification(data.title||'Edições Shalom',{
   body:data.body||'Você tem uma atualização.',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',
   tag:data.id||'shalom-notification',data:{id:data.id}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const id=event.notification.data?.id;
 const url=new URL('/',self.location.origin);if(id)url.searchParams.set('notice',id);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
   for(const client of clients){if(new URL(client.url).origin===self.location.origin){await client.navigate(url.href);return client.focus()}}
   return self.clients.openWindow(url.href);
 }));
});
