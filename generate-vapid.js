// generate-vapid.js
import webpush from 'web-push';

// Isso vai gerar um novo par de chaves VAPID
const vapidKeys = webpush.generateVAPIDKeys();

console.log('Chave Pública VAPID:', vapidKeys.publicKey);
console.log('Chave Privada VAPID:', vapidKeys.privateKey);
