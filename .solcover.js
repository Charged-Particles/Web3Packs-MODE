require('dotenv').config();

module.exports = {
    mocha: {
      reporter: 'mocha-junit-reporter',
      grep: "@skip-on-coverage", // Find everything with this tag
      invert: true               // Run the grep's inverse set.
    },
    skipFiles: [
      "lib/RelayRecipient.sol",
      "defender",
      "tests"
    ]
  };