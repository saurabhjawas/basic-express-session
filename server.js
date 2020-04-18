/*
tutorial refrence: https://medium.com/@evangow/server-authentication-basics-express-sessions-passport-and-curl-359b7456003d

Addon tutorial to use postgresdb as session store: https://javabeat.net/expressjs-session-store/

*/
const express = require('express')
const bodyParser = require('body-parser')
const uuid = require('uuid/v4')
const session = require('express-session')

// as we are going to use postgres as asession store so below import is not needed
// const FileStore = require('session-file-store')(session) 

const PostgresSessionStore = require('connect-pg-simple')(session)

const passport = require('passport')
const LocalSrategy = require('passport-local').Strategy
const axios = require('axios')
const bcrypt = require('bcrypt')

// const users = [
//   {id: '2f24vvg', email: 'test@test.com', password: 'password'}
// ]

// configure passport.js to use the local strategy
passport.use(new LocalSrategy(
  { usernameField: 'email' },
  (email, password, done) => {
    console.log('inside Local strategy callback');
    // here is where you make a call to the database
    // to find the user based on their username or email address
    // for now, we'll just pretend we found that it was users[0]
    // const user = users[0];

    axios.get(`http://localhost:5000/users?email=${email}`)
    .then(res => {
      const user = res.data[0]

      if (!user) {
        return done(null, false, { message: 'invalid credentials.\n' })      
      }
      if (!bcrypt.compareSync(password, user.password)) {
        return done(null, false, { message: 'Invalid credentials.\n' });
      }

      return done(null, user)
    })
    .catch(err => done(err))
  }
))

// tell passport how to serialize the user
passport.serializeUser((user, done) => {
  console.log('Inside serializeUser callback. User id is saved to the session file store here');
  console.log(`Here is what is serialized: ${user.id}`);
  done(null, user.id);
});

// tell passport hoe to desrialize the user
passport.deserializeUser((id, done) => {
  console.log('Inside deserialize use callback');
  console.log(`The user info0rmation stored in session store is ${id}`);

  // const user = id === users[0].id ? users[0] : false
  axios.get(`http://localhost:5000/users/${id}`)
  .then(res => done(null, res.data))
  .catch(err => done(err, false))

  // return done (null, user)
})


const app = express();

// making express app to be able to parse json and url encoded data
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());



// configuration of postgressession store
const pgSessionStore = new PostgresSessionStore({
  /*  *connection string is built by following the syntax:
  postgres://USERNAME:PASSWORD@HOST_NAME:PORT/DB_NAME
  */
  conString: "postgres://user_sessionstore:sessionstore@localhost:5432/db_demo_sessionstore"
})


// configure session middleware adding it to the express app
app.use(session({
  genid: req => {
    console.log('Inside session middleware');
    console.log(`Request object sessionID from client: ${req.sessionID}`);
    const generatedId = uuid()
    console.log(`generatedId ${generatedId}`);
    return generatedId 
    // the value returned will be session id
  },
  store: pgSessionStore, // new FileStore(), -- this one is replace with session store on posgres
  secret: 'SECRET_SESSION_KEY',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
  console.log('Inside the homepage callback function')
  console.log(req.sessionID)
  res.send(`You hit home page!\n`)
})

// create the login get and post routes
app.get('/login', (req, res) => {
  console.log('Inside GET /login callback function')
  console.log(req.sessionID)
  res.send(`You got the login page!\n`)
})

app.post('/login', (req, res, next) => {
  console.log('Inside POST /login callback function')

  // below callback function(err, user, info) will be called  
  // * and give us access to user object in case the authentication is successfully
  // * OR give us access to error object if authentication is not successfull
  passport.authenticate('local', (err, user, info) => {
    console.log('Inside passport.authenticate() callback');
    console.log(`req.session.passport: ${JSON.stringify(req.session.passport)}`)
    console.log(`req.user: ${JSON.stringify(req.user)}`)
    req.login(user, (err) => {
      console.log('Inside req.login() callback')
      console.log(`req.session.passport: ${JSON.stringify(req.session.passport)}`)
      console.log(`req.user: ${JSON.stringify(req.user)}`)
      return res.send('You were authenticated & logged in!\n');
    })
  })(req, res, next);
})

app.get('/authrequired', (req, res) => {
  console.log('Inside GET /authrequired callback')
  console.log(`User authenticated? ${req.isAuthenticated()}`)
  if(req.isAuthenticated()) {
    res.send('you hit the authentication endpoint\n')
  } else {
    res.redirect('/')
  }
})

app.listen(3000, () => {
  console.log(`listening at port 3000..`);
})

// just a comment