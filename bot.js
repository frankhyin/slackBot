const { RTMClient } = require('@slack/client');
const token = process.env.SLACK_TOKEN;

const rtm = new RTMClient(token);
rtm.start();


const {Wit, log} = require('node-wit');

const client = new Wit({
  accessToken: process.env.WIT_TOKEN,
  logger: new log.Logger(log.DEBUG) // optional
});

// client.message('Next Friday at 3:30am')
// .then(data => console.log(data)).catch(console.error);

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


  if (message.text.split(' ')[0] === 'remind'){


    client.message(message.text)
    .then(function(data){
      console.log(data.entities.datetime[0].value);
      return rtm.sendMessage(data.entities.datetime[0].value, message.channel)
    })
    .then((res) => {
      console.log('Message sent: ', res.ts);
    })
    .catch(console.error);

    
  }

  console.log(`(channel:${message.channel}) ${message.user} says: ${message.text}`);
});