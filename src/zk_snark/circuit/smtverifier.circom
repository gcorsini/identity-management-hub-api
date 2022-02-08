pragma circom 2.0.0;

include "treelevel.circom";
include "templates/smt/smtverifier.circom";

component main = SMTVerifier(getTreeLevel());
