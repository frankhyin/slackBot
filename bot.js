const { RTMClient } = require('@slack/client');
const token = process.env.SLACK_TOKEN;

const rtm = new RTMClient(token);
rtm.start();

rtm.on('message', (message) => {

  if ( (message.subtype && message.subtype === 'bot_message') ||
       (!message.subtype && message.user === rtm.activeUserId) ) {
    return;
  }

  if (message.text === 'ping'){
    rtm.sendMessage('pong', message.channel)
    .then((res) => {
        console.log('Message sent: ', res.ts);
    })
    .catch(console.error);
  }

  console.log(`(channel:${message.channel}) ${message.user} says: ${message.text}`);
});