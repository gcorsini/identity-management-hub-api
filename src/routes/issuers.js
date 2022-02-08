const express = require('express');
const router = express.Router();
fs = require('fs');
const jsonDiff = require('json-diff');
const axios = require('axios');
axios.defaults.headers.get['Content-Type'] = 'application/json';
axios.defaults.headers.post['Content-Type'] = 'application/json';

// Bearer Token for MATTR-API
MATTR_TOKEN_PROMISE.then(token => {
  if (token === undefined) {
    console.log("Please restart the server as the mattr token is undefined!");
  } else {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
});

// Array mapping function that only returns the DID if it fits the type. Otherwise returns an etmpty string
async function filterDIDList(inputArray) {
  const filteredArray = await Promise.all(
    inputArray.map(async element => {     
      if (element.localMetadata.initialDidDocument.publicKey[0].type === 'Bls12381G2Key2020') {
        return element.did;
      } else {
        return "";
      }
    })
  );
  return filteredArray;
}

router.get('/', function (req, res) {
  // Get list of all Issuers
  axios.get(`https://${process.env.MATTR_TENANT}/core/v1/dids`)
  .then(listOfDID => {
    // Filter the DIDs, so that only the correct key-type is present
    filterDIDList(listOfDID.data.data).then(filteredDIDArray => {
      res.send(filteredDIDArray.filter(element => {
        // Remove all elements that are empty
        return element !== '';
      }));
    })
  })
  .catch(err => {
    console.error(err);
    res.sendStatus(500);
  });
})

router.post('/', function (req, res) {
  // Create a new Issuer
  axios.post(`https://${process.env.MATTR_TENANT}/core/v1/dids`, 
    {
      "method": "key",
      "options": {
        "keyType": "bls12381g2"
      }
    },
    {
      headers: {'Content-Type': 'application/json'}
    }
  )
  .then(newIssuer => {
    fs.promises.writeFile(process.cwd() + '/issuers/' + newIssuer.data.did.replace(/:/g, '_') + '.txt', JSON.stringify(newIssuer.data))
    .then(() => {
      console.log('Issuer file generated.');
      res.send(newIssuer.data);
    })
    .catch(e => {
      console.error(e);
      res.sendStatus(500);
    });
  })
  .catch(err => {
    console.error(err);
    res.sendStatus(500);
  });
})

router.post('/verify', function (req, res) {
  let issuerDIDDoc = req.body;
  console.log(issuerDIDDoc);


  axios.get(`https://${process.env.MATTR_TENANT}/core/v1/dids/${issuerDIDDoc.did}`)
  .then(apiResult => {

    if (jsonDiff.diff(apiResult.data.localMetadata, issuerDIDDoc.localMetadata) === undefined
      && jsonDiff.diff(apiResult.data.registrationStatus, issuerDIDDoc.registrationStatus) === undefined
    ) {
      // If ok use smart contract
      res.send({ verified: true });
    } else {
      res.send({ verified: false, reason: 'DID is invalid' });
    }
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


router.get('/vcs', function (req, res) {
  // Get list of all DIDs
  axios.get(`https://${process.env.MATTR_TENANT}/core/v1/credentials?tag=covidCert`)
  .then(apiResult => {
    vcs = apiResult.data.data;
    res.send(apiResult.data.data)
  })
  .catch(err => {
    console.error(err);
    res.sendStatus(500);
  });
})

module.exports = router;