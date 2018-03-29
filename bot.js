// SLACK RTM
const { RTMClient } = require('@slack/client');
const token = process.env.SLACK_TOKEN;
const rtm = new RTMClient(token);

// MONGO DB
const models = require('./models/models');
const User = models.User;

// DialogFlow 
const dialogflow = require('dialogflow');
const sessionClient = new dialogflow.SessionsClient();
const projectId = "slackbot-e9b9d";
const languageCode = 'en-US';

// Google Calendar API
var {google} = require('googleapis');
const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

const scopes = ['https://www.googleapis.com/auth/calendar'];




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

  User.find({slackID: message.user})
  .then(user => {
    console.log(user);
    if (!user){

      // if user hasn't been added to database, make new oauth url:
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: message.user
      });
      
      // send oauth url to user
      rtm.sendMessage(url, message.channel) // message.channel is less secure cause other people can see it
      .then((res) => {
          console.log('Message sent: ', res.ts);
      })
      .catch(console.error);
    }
    else {
      const sessionId = message.user;
      const sessionPath = sessionClient.sessionPath(projectId, sessionId);
      const query = message.text;
    
      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: query,
            languageCode: languageCode,
          },
        },
      };   
      sessionClient
      .detectIntent(request)
      .then(responses => {
        console.log('Detected intent');
        const result = responses[0].queryResult;
        console.log(`  Query: ${result.queryText}`);
        console.log(`  Response: ${result.fulfillmentText}`);
        if (result.intent) {
          console.log(`  Intent: ${result.intent.displayName}`);
        } else {
          console.log(`  No intent matched.`);
        }
    
        return rtm.sendMessage(result.fulfillmentText, message.channel);
      })
      .then((res) => {
        console.log('Message sent: ', res.ts);
      })
      .catch(err => {
        console.error('ERROR:', err);
      });
    }
  })
  .catch(console.error)
  return;


 



  console.log(`(channel:${message.channel}) ${message.user} says: ${message.text}`);
});


const express = require('express');
const app = express();
app.get('/redirect', (req, res)=>{
  console.log(req.query);
  oauth2Client.getToken(req.query.code, (err, tokens) => {
    // Now tokens contains an access_token and an optional refresh_token. Save them.
    if (!err) {
      oauth2Client.setCredentials(tokens);
      console.log('tokens', tokens);
      User.findOrCreate({slackID: req.query.state}, {
          slackID: req.query.state,
          access_token : tokens.access_token,
          token_type: tokens.token_type,
          expiry_date: tokens.expiry_date
        }, (err, user)=>{
        console.log(err, user);
      })
    }
  });
  res.send("Authentication Successful!");
});

app.listen(8080, () => console.log('Listening on port 8080!'))