require('./config/config')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const hbs = require('hbs')
const session = require('express-session')
const fs = require('fs');
const MongoStore = require('connect-mongo')(session)
const Mongo_URL = process.env.urldb
var { islogged } = require('./config/validations')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(express.static(__dirname + '/public'));
hbs.registerPartials(__dirname + '/views/parciales');
app.set('view engine', 'hbs');
app.use(session({
    secret: "secretkey",
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365
    },
    resave: false,
    sameSite: true,
    saveUninitialized: true,
    store: new MongoStore({
        url: Mongo_URL,
        autoReconnect: true
    })
}))
app.use(islogged)
app.use(require('./routes/bookbrary'))
app.listen(process.env.PORT, () => {
    console.log("Escuchando en el puerto 3000");
});