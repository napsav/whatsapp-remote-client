var express = require('express');
var router = express.Router();
const fs = require('fs');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config()
const SESSION_FILE_PATH = process.env.SESSIONFILE;
let loading = true;
let mediaObj = {}
// Load the session data if it has been previously saved
let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

// Use the saved values
const client = new Client({
  session: sessionData
});

Object.defineProperty(Array.prototype, 'chunk', {
  value: function (chunkSize) {
    var R = [];
    for (var i = 0; i < this.length; i += chunkSize)
      R.push(this.slice(i, i + chunkSize));
    return R;
  }
});

// Save session values to the file upon successful auth
client.on('authenticated', (session) => {
  sessionData = session;
  fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
    if (err) {
      console.error(err);
    }
  });
});

client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
  loading = false;
});

client.initialize();

client.on('message', message => {
  console.log(message);
});

//

router.get('/', function (req, res, next) {
  if (loading) {
    res.send("In caricamento")
  } else {
    let pagine = null;
    client.getChats().then(chat => {
      //chats.sort(function (a, b) { return b.timestamp - a.timestamp });
      pagine = chat.chunk(15)
      //console.log(pagine[0]); fs.writeFileSync('/home/saverio/progetti/whatsapp-remote-client/chat.json', JSON.stringify(chats))
      res.render('index', { title: 'Home', chats: pagine[0] });
    })
  }
});

router.get('/chat/:idChat', function (req, res, next) {
  if (loading) {
    res.send("In cariamento")
  } else {
    client.getChatById(req.params.idChat).then(chat => {
      chat.fetchMessages().then(messages => {
        messages.forEach(mess => {
          if (mess.hasMedia && mess.type === 'image') {
            if (mediaObj[mess.mediaKey] === undefined) {
              console.log("downloading media")
              mess.downloadMedia().then(media => {
                mediaObj[mess.mediaKey] = { data: media.data, mime: media.mimetype };
              });
            }
          } else if (mess.type === 'ptt') {
            console.log('audio trovato')
            console.log(mess)
          }
        })
        res.render('chat', { chat: chat , messages: messages, mediaObj: mediaObj})
      })
    }).catch(err => console.log(err))
  }
})

router.post('/chat/:idChat/send', function (req, res, next) {
  client.sendMessage(req.params.idChat, req.body.testo)
  res.redirect(`/chat/${req.params.idChat}`)
})

router.get('/media/:mediaKey', function (req, res, next) {
  let image = mediaObj[decodeURIComponent(req.params.mediaKey)]
  console.log(decodeURIComponent(req.params.mediaKey))
  res.send(`<img src="data:${image.mimetype};base64, ${image.data}">`)
})

module.exports = router;
