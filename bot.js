// SLACK RTM
const { RTMClient, WebClient } = require('@slack/client');
const token = process.env.SLACK_TOKEN;
const rtm = new RTMClient(token);
const web = new WebClient(token);

// MONGO DB
const models = require('./models/models');
const User = models.User;

// DialogFlow 
const dialogflow = require('dialogflow');
const sessionClient = new dialogflow.SessionsClient();
const projectId = "slackbot-e9b9d";
const languageCode = 'en-US';

// Google Calendar API
// const calendar = require('calendar/calendar')
const googleapis = require('googleapis');
const google = googleapis.google;
// const {google} = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const cal = google.calendar('v3');
// const cal = googleapis.discover('calendar', 'v3').execute((err, client) => {
//   console.log("cal", err, client)
// });

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
    return;
  }

  User.findOne({slackID: message.user}).exec()
  .then(user => {
    console.log(user);
    if (!user){

      // if user hasn't been added to database, make new oauth url:
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: message.user
      });
      
      const data = {
        text: `<@${message.user}> please authenticate yourself by clicking on the link below:`,
        attachments: [{
          fallback: `oauth: ${url}`,
          actions: [{
            type: "button",
            text: "Authenticate Using Google",
            url: url}]
          }]
        }

      // open a new conversation with the user so that the link is shared privately:
      web.conversations.open({users: message.user})
      .then((res) => {
          console.log('opened', res);
          data.channel = res.channel.id;
          return web.chat.postMessage(data)      
      })
      .then((res) => {
          console.log('Message sent: ', res.ts);
      })
      .catch(console.error);

    }
    else if (message.text === "!mySchedule"){
      getCalendarEvents(message);
    }
    else {
      dialogSession(message);
    }
  })
  .catch(console.error)
  return;

  console.log(`(channel:${message.channel}) ${message.user} says: ${message.text}`);
});


function dialogSession(message){
  // DialogFlow AI stuff
      
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

    // when ready to schedule, cal calendar function
    if (result.fulfillmentText === "Reminder set!"){
      const fields = result.parameters.fields;

      // obsolete date and time fields
      // const date = fields.date.stringValue;
      // const time = (new Date(fields.time.stringValue)).getHours();

      const datetime = fields.datetime.stringValue;

      const data = {
        event: fields.event.stringValue,
        start: (new Date(date)),
        end: (new Date(date))
      };
      data.start.setHours(time);
      data.end.setHours(time+1);
      console.log('data', data)

      makeCalendarEvent(message, data);
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


function makeCalendarEvent(message, data){
  User.findOne({slackID: message.user}).exec()
  .then(user => {

    const newEvent = {
      summary: data.event,
      start: {
        dateTime: data.start
      },
      end: {
        dateTime: data.end
      }
    }
    console.log('newEvent',newEvent);

    oauth2Client.setCredentials(user.tokens);

    cal.events.insert({
      auth: oauth2Client,
      calendarId: 'primary',
      resource: newEvent,
    }, function(err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err)
        return;
      }
      console.log('Event created: %s', event.data.htmlLink)
    });
  })
  .catch(console.error)
}

function getCalendarEvents(message){
  User.findOne({slackID: message.user}).exec()
  .then(user => {

    oauth2Client.setCredentials(user.tokens);


    const dateMin = new Date();
    const dateMax = new Date();
    dateMax.setHours(23, 59, 59, 999);

    console.log(dateMin, dateMax);


    cal.events.list({
      auth: oauth2Client,
      calendarId: 'primary',
      timeMin: dateMin,
      timeMax: dateMax,
      singleEvents: true,
      orderBy: 'startTime'
    }, function(err, response) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err)
        return;
      }
      console.log(response.items)
    });
  })
  .catch(console.error)
}

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
          tokens: tokens
        }, (err, user)=>{
        console.log(err, user);
      })
    }
  });
  res.send("Authentication Successful!");
});

app.listen(8080, () => console.log('Listening on port 8080!'));
