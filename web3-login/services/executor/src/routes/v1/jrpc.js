const express = require('express');
const jayson = require('jayson');
const { jrpcController } = require('../../controllers');

const router = express.Router();
const server = new jayson.Server(jrpcController, {
  collect: true,
});

router.post('/', server.middleware());

module.exports = router;
