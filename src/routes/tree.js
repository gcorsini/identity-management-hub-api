require('dotenv').config();
const axios = require('axios');
const express = require('express');
const router = express.Router();
const path = require("path");
const fs = require("fs");

// Imports for zk-SNARK
const { newMemEmptyTrie  } = require("circomlibjs");
const snarkjs = require("snarkjs");
const crypto = require('crypto');

// Imports for Smart Contract (not used)
/*
const Web3 = require('web3');
const contract = require('@truffle/contract');
const plonkVerifierJSON = require('../../build/contracts/PlonkVerifier.json');
*/

// Bearer Token for MATTR-API
MATTR_TOKEN_PROMISE.then(token => {
  if (token === undefined) {
    console.log("Please restart the server as the mattr token is undefined!");
  } else {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
});
axios.defaults.headers.post['Content-Type'] = 'application/json';

/*
if (typeof web3 !== 'undefined') {
  var web3 = new Web3(web3.currentProvider); 
} else {
  var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545'));
}
//const web3 = new Web3(new Web3.providers.HttpProvider(process.env.INFURA_API));

const PlonkVerifier = contract(plonkVerifierJSON);
PlonkVerifier.setProvider(web3.currentProvider);
*/
/* 
new web3.eth.Contract([
  {
    "constant": true,
    "inputs": [],
    "name": "output",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "pure",
    "type": "function"
  }
], '0x35c113E1AB11B3001e9085CBafD224FfC3470C67'); */

let smt;
const treeLevel = 7;

// Merkle Tree used as whitelist
newMemEmptyTrie().then(result => {
  smt = result;
});

const didQualifier = 'did:key:';

// Array mapping function that only returns the DID if its in the tree otherwise returns an etmpty string
async function filterDIDList(inputArray) {
  const filteredArray = await Promise.all(
    inputArray.map(async element => {
      let bigIntDID = BigInt('0x' + crypto.createHash('md5').update(element.did.replace(didQualifier, '')).digest('hex'));
      let result = await smt.find(bigIntDID);
      
      if (result.found && element.localMetadata.initialDidDocument.publicKey[0].type === 'Bls12381G2Key2020') {
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
    // Filter the DIDs, so that only the correct key-type AND elements from the tree are present
    filterDIDList(listOfDID.data.data).then(filteredDIDArray => {
      res.send(filteredDIDArray.filter(element => {
        // Remove all element that are empty
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
  // Create a new issuer
  axios.post(`${process.env.SERVER_ADR}:${process.env.API_PORT}/issuers`)
  .then(createdIssuer => {
    // Add the new issuer to the tree
    let bigIntDID = BigInt('0x' + crypto.createHash('md5').update(createdIssuer.data.did.replace(didQualifier, '')).digest('hex'));
    smt.insert(bigIntDID,bigIntDID);
    res.send({ 'did': createdIssuer.data.did });
  })
})

router.post('/:issuerDID', function (req, res) {
  // Add a new issuer with his DID to the tree
  let bigIntDID = BigInt('0x' + crypto.createHash('md5').update(req.params.issuerDID.replace(didQualifier, '')).digest('hex'));
  smt.insert(bigIntDID,bigIntDID);
  res.sendStatus(200);
})

router.delete('/:issuerDID', function (req, res) {
  // Delete an existing issuer
  let bigIntDID = BigInt('0x' + crypto.createHash('md5').update(req.params.issuerDID.replace(didQualifier, '')).digest('hex'));
  smt.delete(bigIntDID);
  res.sendStatus(200);
})

router.get('/:issuerDID', function (req, res) {
  // Find and proove that the issuerDID is in the tree by using the smart contract
  let bigIntDID = BigInt('0x' + crypto.createHash('md5').update(req.params.issuerDID.replace(didQualifier, '')).digest('hex'));
  smt.find(bigIntDID).then(result => {
    if(result.found) {
      console.log("Found it!");
    }
  
    let siblings = result.siblings;
    for (let i=0; i<siblings.length; i++) siblings[i] = smt.F.toObject(siblings[i]);
    while (siblings.length<treeLevel) siblings.push(0);
  
    let inputForWitness = {
      enabled: 1,
      fnc: 0,
      root: smt.F.toObject(smt.root),
      siblings: siblings,
      oldKey: 0,
      oldValue: 0,
      isOld0: 0,
      key: bigIntDID,
      value: smt.F.toObject(result.foundValue)
    };

    const wasmFile = path.join(__dirname, "..", "zk_snark", "circuit", "smtverifier7_js", "smtverifier7.wasm");
    const zkeyFile = path.join(__dirname, "..", "zk_snark", "circuit", "smtverifier7_zkey", "circuit_final.zkey");

    snarkjs.plonk.fullProve(inputForWitness, wasmFile, zkeyFile)
    .then(result => {

      snarkjs.plonk.verify(
        JSON.parse(fs.readFileSync(path.join(__dirname, "..", "zk_snark", "circuit", "smtverifier7_zkey", "verification_key.json"))), 
        result.publicSignals, 
        result.proof
      ).then(proofResult => {
        if (proofResult === true) {
          res.send({ "verified": true });
        } else {
          res.send({ "verified": false });
        }
      })
      .catch(error => {
        console.error(error);
        // If there was an error during the verification, it is consided false.
        res.send({ "verified": false });
      })

      /*
      Smart Contract should have been used instead...
      PlonkVerifier.deployed().then(pv => {
        // Submit to Smart Contract
        pv.verifyProof(result.proof, result.publicSignals).then(solidityIsValid => {
          console.log(solidityIsValid);
          if (solidityIsValid === true) {
            res.send({ "verified": true });
          } else {
            res.send({ "verified": false });
          }
        })
      });
      */
      console.log("proof ", result.proof);
      console.log("publicSignals ", result.publicSignals);
    })
  })
})

module.exports = router;