var express = require('express');
var router = express.Router();
const fs = require('fs');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { time } = require('console');
require('dotenv').config()
const SESSION_FILE_PATH = process.env.SESSIONFILE;
let loading = true;
let mediaObj = {}
let audioObj = {}
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
  //mess.authorName = contact.name

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
      if (Object.keys(req.query).length > 0) {
        console.log(req.query)
        res.render('index', { title: 'Home', chats: pagine[req.query.p], availablePages: pagine.length });
      } else {
        console.log("dadasdasdasd")
        res.render('index', { title: 'Home', chats: pagine[0], availablePages: pagine.length });
      }

    })
  }
});


router.get('/chat/:idChat', function (req, res, next) {
  if (loading) {
    res.send("In caricamento")
  } else {
    client.getChatById(req.params.idChat).then(chat => {
      chat.fetchMessages().then(async messages => {
        for (const mess of messages) {
          if (mess.hasMedia && mess.type === 'image') {
            if (mediaObj[mess.mediaKey] === undefined) {
              console.log("downloading media");
              mess.downloadMedia().then(media => {
                mediaObj[mess.mediaKey] = { data: media.data, mime: media.mimetype };
              });
            }
          }
          if (!mess.fromMe && chat.isGroup) {
            console.log('downloading contacts');
            let contact = await client.getContactById(mess.author)
            mess.authorName = contact.name;
            console.log('contacts downloaded');
          }
          if (mess.hasQuotedMsg) {
            let quotedMessage = await mess.getQuotedMessage()
            if (!quotedMessage.hasMedia && quotedMessage.type==='chat') {
              mess.quotedBody = quotedMessage.body
            } else {
              mess.quotedBody = 'Non supportato'
            }
            let author = await client.getContactById(quotedMessage.author)
            if(!(author.name===undefined)) {
              mess.quotedAuthor = author.name
            } else {
              mess.quotedAuthor = quotedMessage.author
            }
          }
          console.log(mess)
        }
        console.log('rendering')
        res.render('chat', { chat: chat, messages: messages, mediaObj: mediaObj })
      }).catch(err => console.log(err))
    })
  }
})

router.post('/chat/:idChat/send', function (req, res, next) {
  let message = req.body.testo.trim()
  if (message === "") {
    res.redirect(`/chat/${req.params.idChat}`)
  } else {
    client.sendMessage(req.params.idChat, message)
    res.redirect(`/chat/${req.params.idChat}`)
  }
})

router.get('/media/:mediaKey', function (req, res, next) {
  let image = mediaObj[decodeURIComponent(req.params.mediaKey)]
  console.log(decodeURIComponent(req.params.mediaKey))
  res.send(`<img src="data:${image.mimetype};base64, ${image.data}">`)
})

module.exports = router;
