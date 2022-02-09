require('dotenv').config();
const express = require('express');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const swaggerDocu = require('./swagger.json');

MATTR_TOKEN_PROMISE = getMattrToken();

// Routes
const issuersRouter = require('./routes/issuers');
const verifiableCredentialsRouter = require('./routes/verifiableCredentials');
const treeRouter = require('./routes/tree');

const app = express();

app.use(express.json());
app.use(express.urlencoded());

app.use('/issuers', issuersRouter);
app.use('/vcs', verifiableCredentialsRouter);
app.use('/tree', treeRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocu));

// If the MATTR_TOKEN is required, e.g. to use in Postman
app.get('/', function (req, res) {
  MATTR_TOKEN_PROMISE.then(token => {
    if (token === undefined) {
      console.log("Please restart the server as the mattr token is undefined!");
      res.sendStatus(500);
    } else {
      console.log("MATTR_TOKEN: " + token);
      res.sendStatus(200);
    }
  });
})

// listen on port 3000
app.listen(process.env.API_PORT, function (err) {
  if (err) {
    throw err;
  }
  console.log('API started on port ' + process.env.API_PORT);
})

// Authenticate to MATTR-API
async function getMattrToken() {
  let token = await axios
  .post('https://auth.mattr.global/oauth/token', 
    {
      "audience": process.env.MATTR_AUDIENCE,
      "client_id": process.env.MATTR_CLIENT_ID,
      "client_secret": process.env.MATTR_CLIENT_SECRET,
      "grant_type": "client_credentials"
    },
    {
      headers: {'Content-Type': 'application/json'}
    }
  )   
  .then(res => {
    // console.log(`MATTR_TOKEN: ${res.data.access_token}`);
    return res.data.access_token
  })
  .catch(err => {
    console.error(err);
    return undefined;
  });

  return token;
}