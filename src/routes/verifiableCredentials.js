require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

// Bearer Token for MATTR-API
MATTR_TOKEN_PROMISE.then(token => {
  if (token === undefined) {
    console.log("Please restart the server as the mattr token is undefined!");
  } else {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
});
axios.defaults.headers.post['Content-Type'] = 'application/json';
const router = express.Router();

router.get('/', function (req, res) {
  // Get list of all VCs
  axios.get(`https://${process.env.MATTR_TENANT}/core/v1/credentials?tag=covidCert`)
  .then(apiResult => {
    vcs = apiResult.data.data;
    console.log(vcs);
    res.send(vcs);
  })
  .catch(err => {
    console.error(err);
    res.sendStatus(500);
  });
  
})

router.delete('/:id', function (req, res) {
  // Delete a specific VC
  axios.delete(`https://${process.env.MATTR_TENANT}/core/v1/credentials/${req.params.id}`)
  .then(apiResult => {
    if (apiResult.status === 204) {
      res.send({"deleted": true});
    } else {
      res.send({"deleted": false});
    }
  })
  .catch(err => {
    console.error(err);
  });
})

router.post('/', 
  body('first_name').trim().isLength({ min: 1 }).withMessage('Name empty.')
  .isAlpha().withMessage('Name must be alphabet letters.').escape(),
  body('family_name', 'Empty name').trim().isLength({ min: 1 }).escape(),
  body('birthday', 'Invalid birthday').isISO8601().toDate(),
  function (req, res) {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let subjectDid = req.body.did;
    let dBirthday = new Date(req.body.birthday);
    console.log(req.body);
    contentData = {
      "subjectDID": subjectDid,
      "claims": {
        "givenName": req.body.first_name,
        "familyName": req.body.family_name,
        "birthDate": `${dBirthday.getFullYear()}-${("0" + (dBirthday.getMonth() + 1)).slice(-2)}-${("0" + dBirthday.getDate()).slice(-2)
      }`
      },
      "issuerDid": req.body.issuer_did
    };

    axios.post(`${process.env.SERVER_ADR}:${process.env.API_PORT}/vcs/generate`, contentData)
    .then(result => {
      console.log("res: ", result.data);
      res.send({ "targetDID": subjectDid, "cred": result.data });
    }).catch(err => {
      console.error(err);
      res.sendStatus(500);
    });
})

router.post('/generate', function (req, res) {
  console.log("body", req.body);
  var dRequest = new Date();

  const credentialData = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://schema.org"
    ],
    "subjectId": req.body.subjectDID,
    "type": [
      "VerifiableCredential",
      "Person",
      "Permit"
    ],
    "claims": {
      "givenName": req.body.claims.givenName,
      "familyName": req.body.claims.familyName,
      "birthDate": req.body.claims.birthDate,
      "name": "VaccinationCovid-19",
      "validFrom": `${dRequest.getFullYear()}-${("0" + (dRequest.getMonth() + 1)).slice(-2)}-${("0" + dRequest.getDate()).slice(-2)
    }`
    },
    "issuer": {
      "id": req.body.issuerDid,
      "name": "LabOne"
    },
    "persist": false,
    "tag": "covidCert",
    "revocable": true
  };
  console.log(credentialData);
  
  axios.post(`https://${process.env.MATTR_TENANT}/core/v1/credentials`, 
    credentialData,
    {
      headers: {'Content-Type': 'application/json'}
    }
  )   
  .then(apiResult => {
    console.log(apiResult.data);
    res.json(apiResult.data)
  })
  .catch(err => {
    console.log("Credential Data: ", credentialData);
    console.error(err.response.data);
  });
})

router.post('/verifyFullCert', function (req, res) {
  console.log(req.body.credential)
  jsonData = { credential: req.body.credential };

  axios.post(`https://${process.env.MATTR_TENANT}/core/v1/credentials/verify/`,
    jsonData
  )
  .then(apiResult => {
    let vcs = apiResult.data;
    console.log(vcs);
    res.send(vcs);
  })
  .catch(err => {
    // Check if the request arrived sucessfully at the API
    if (err.response !== undefined && err.response.status === 400) {
      console.error(`${err.response.data.code}: ${err.response.data.message}` )
    } else {
      console.error(err.response.data);
    }
    res.sendStatus(500);
  });
})

// Receive a POST request to /callback & print it out to the terminal
router.post('/callback', function (req, res) {
  const body = req.body
  console.log(body)
  console.log(res.body)
  res.sendStatus(200)
/*
  {
    presentationType: 'QueryByFrame',
    challengeId: 'uniqueIdentifierPerRequest1924',
    claims: {
      id: 'did:key:z6MkrvbzdHukohWFkmQYtPL9ENhzd3iwm9X9RuRDgw2JAtQy',
      'http://schema.org/familyName': 'Corsini',
      'http://schema.org/validFrom': '2022-01-10'
    },
    verified: true,
    holder: 'did:key:z6MksAnN6w2mn3aRK91Ar6esK43zysJdVt3mFEV89MBZh2gj'
  }
*/  
})

// Create an Express server that will serve a redirect that the mobile app can use
router.get('/qr', function (req, res) {
  const body = res.body
  console.log("jwsUrl: ",jwsUrl)
  res.redirect(jwsUrl)
})

// Send a certificate to a specific target (tested with public DID from a MATTR wallet)
router.post('/share/:targetDid', function (req, res) {
  var credentialData = req.body;
  const encryptionData = {
    "senderDidUrl": process.env.senderDidUrl,
    "recipientDidUrls": [ req.params.targetDid ],
    "payload": {
      "id": uuidv4(),
      "type": "https://mattr.global/schemas/verifiable-credential/offer/Direct",
      "to": [ req.params.targetDid ],
      "from": process.env.senderDid,
      "created_time": Date.now(),
      "body": {
        "domain": process.env.MATTR_TENANT,
        "credentials": [ JSON.parse(JSON.stringify(credentialData.credential)) ]   
      }
    }
  }
  console.log(encryptionData);
  console.log("Credentials: ", encryptionData.payload.body.credentials);

  // Encrypt the data before sending it to the Wallet
  axios.post(`https://${process.env.MATTR_TENANT}/core/v1/messaging/encrypt`,
    encryptionData
  ).then(apiResult => {
    const jweData = apiResult.data.jwe;
    console.log("messaging/encrypt resulting jwe: ", jweData);
    console.log("header: ", jweData.recipients[0].header);
    const sendingData = {
      "to": req.params.targetDid,
      "message":jweData
    }
    // Send an encrypted message containing the VC to the Wallet
    axios.post(`https://${process.env.MATTR_TENANT}/core/v1/messaging/send`,
      sendingData
    ).then(apiResult => {
      res.send({ "sent": true });
    }).catch(err => {
      console.log("Issue with messaging/send and payload: ", sendingData);
      console.error(err.response.data);
      res.send({ "sent": false });
    })
  }).catch(err => {
    console.log("Issue with messaging/encrypt and payload: ", encryptionData);
    console.error(err.response.data);
    res.sendStatus(500);
  })
})


// ATTENTION: This route does NOT work yet!!
router.post('/verify', function (req, res) {
  // In a production system, this should be supplied by the verifier!
  tmpVerifier = process.env.MATTR_VERIFIERDID;
  axios.post(`https://${process.env.MATTR_TENANT}/core/v1/presentations/requests`,
    {
      "challenge": uuidv4(),
      "did": tmpVerifier,
      "templateId": process.env.MATTR_VERIFICATION_TEMPLATEID,
      "callbackUrl": `${process.env.NGROK_URL}/vcs/callback`
    }
  ).then(presentationRequestResult => {
    requestPayload = presentationRequestResult.data.request;
console.log(requestPayload);
    axios.get(`https://${process.env.MATTR_TENANT}/core/v1/dids/${tmpVerifier}`
    ).then(verifierResult => {
      // ToDo: Is this the correct did??
      didAuthentication = verifierResult.data.didDocument.authentication[0];

      axios.post(`https://${process.env.MATTR_TENANT}/core/v1/messaging/sign`,
        {
          "didUrl": didAuthentication,
          "payload": requestPayload
        }
      ).then(signedMessage => {
        jwsUrl = `https://${process.env.MATTR_TENANT}/?request=${signedMessage.data}`;
        didcommUrl = `didcomm://${process.env.NGROK_URL}/vcs/qr`;
        
        // generate a QR Code using the didcomm url
        var QRCode = require('qrcode');
        QRCode.toString(didcommUrl, {type: 'terminal'}, function (err, url) {
            console.log(url)
        })

        // generate the Deeplink for the MATTR Wallet
        let buf = Buffer.from(didcommUrl);
        let encodedData = buf.toString('base64');
        var deep = `global.mattr.wallet://accept/${encodedData}`
        console.log('\n','Deeplink for the MATTR Mobile Wallet: \n', deep, '\n')
        
      })

    })
    res.sendStatus(200);
  })
  .catch(err => {
    // Check if the request arrived sucessfully at the API
    if (err.response !== undefined && err.response.status === 400) {
      console.error(`${err.response.data.code}: ${err.response.data.message}` )
    } else {
      console.error(err);
    }
    res.sendStatus(500);
  });

})


module.exports = router;