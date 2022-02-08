pragma circom 2.0.0;

include "treelevel.circom";
include "templates/smt/smtprocessor.circom";

component main = SMTProcessor(getTreeLevel());
